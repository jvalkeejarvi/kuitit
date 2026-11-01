using System.Net;
using System.Net.Http.Json;
using Kuitit.Api.Data;
using Kuitit.Api.Files;
using Kuitit.Api.Receipts;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Kuitit.Api.Tests;

public sealed class TrashTests : IAsyncLifetime
{
    private readonly ApiFactory _factory = new();
    private HttpClient _alice = null!;
    private HttpClient _bob = null!;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public ValueTask InitializeAsync()
    {
        _alice = _factory.CreateClientFor("alice");
        _bob = _factory.CreateClientFor("bob");
        return ValueTask.CompletedTask;
    }

    public ValueTask DisposeAsync() => _factory.DisposeAsync();

    private string FilesDir => Path.Combine(_factory.DataDir, "files");

    private async Task<ReceiptDto> CreateAsync(int fileCount = 1)
    {
        var response = await _alice.PostAsync("/api/receipts", TestFiles.Form(fileCount: fileCount), Ct);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        return (await response.Content.ReadFromJsonAsync<ReceiptDto>(Ct))!;
    }

    private static async Task<ReceiptDto[]> ListAsync(HttpClient client, string path = "/api/receipts") =>
        (await client.GetFromJsonAsync<ReceiptDto[]>(path, Ct))!;

    [Fact]
    public async Task Delete_moves_to_trash_and_restore_brings_it_back()
    {
        var receipt = await CreateAsync(fileCount: 2);

        (await _alice.DeleteAsync($"/api/receipts/{receipt.Id}", Ct)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await _alice.DeleteAsync($"/api/receipts/{receipt.Id}", Ct)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await ListAsync(_alice)).Should().BeEmpty();
        // Still viewable (with its files) from the trash, but not editable until restored.
        var viewed = (await _alice.GetFromJsonAsync<ReceiptDto>($"/api/receipts/{receipt.Id}", Ct))!;
        viewed.DeletedAt.Should().Be(_factory.Time.GetUtcNow());
        (await _alice.GetAsync($"/api/receipts/{receipt.Id}/files/{receipt.Files[0].Id}", Ct))
            .StatusCode.Should()
            .Be(HttpStatusCode.OK);
        (
            await _alice.PutAsJsonAsync(
                $"/api/receipts/{receipt.Id}",
                new UpdateReceiptRequest("x", null, null, receipt.PurchasedOn, 24),
                Ct
            )
        )
            .StatusCode.Should()
            .Be(HttpStatusCode.NotFound);
        (await _alice.PostAsync($"/api/receipts/{receipt.Id}/archive", null, Ct))
            .StatusCode.Should()
            .Be(HttpStatusCode.NotFound);
        var trashed = (await ListAsync(_alice, "/api/receipts/trash")).Should().ContainSingle().Subject;
        trashed.DeletedAt.Should().Be(_factory.Time.GetUtcNow());
        trashed.Files.Should().HaveCount(2);
        Directory.GetFiles(FilesDir).Should().HaveCount(2);

        var restored = await _alice.PostAsync($"/api/receipts/{receipt.Id}/restore", null, Ct);

        restored.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ListAsync(_alice)).Should().ContainSingle().Which.Should().BeEquivalentTo(receipt);
        (await ListAsync(_alice, "/api/receipts/trash")).Should().BeEmpty();
    }

    [Fact]
    public async Task Permanent_delete_only_works_on_trashed_receipts()
    {
        var receipt = await CreateAsync(fileCount: 2);

        (await _alice.DeleteAsync($"/api/receipts/{receipt.Id}/permanent", Ct))
            .StatusCode.Should()
            .Be(HttpStatusCode.NoContent);
        (await ListAsync(_alice)).Should().ContainSingle("an active receipt goes to the trash first");

        await _alice.DeleteAsync($"/api/receipts/{receipt.Id}", Ct);
        (await _alice.DeleteAsync($"/api/receipts/{receipt.Id}/permanent", Ct))
            .StatusCode.Should()
            .Be(HttpStatusCode.NoContent);

        (await ListAsync(_alice, "/api/receipts/trash")).Should().BeEmpty();
        (await _alice.PostAsync($"/api/receipts/{receipt.Id}/restore", null, Ct))
            .StatusCode.Should()
            .Be(HttpStatusCode.NotFound);
        Directory.GetFiles(FilesDir).Should().BeEmpty();
    }

    [Fact]
    public async Task Removed_file_can_be_restored_within_the_file_limit()
    {
        var receipt = await CreateAsync(fileCount: 2);
        var fileUrl = $"/api/receipts/{receipt.Id}/files/{receipt.Files[0].Id}";
        await _alice.DeleteAsync(fileUrl, Ct);

        var restored = await _alice.PostAsync($"{fileUrl}/restore", null, Ct);

        restored.StatusCode.Should().Be(HttpStatusCode.OK);
        (await restored.Content.ReadFromJsonAsync<ReceiptDto>(Ct))!.Files.Should().BeEquivalentTo(receipt.Files);
        (await _alice.GetAsync(fileUrl, Ct)).StatusCode.Should().Be(HttpStatusCode.OK);

        await _alice.DeleteAsync(fileUrl, Ct);
        var fill = TestFiles.Files([.. Enumerable.Repeat(TestFiles.Png, ReceiptRules.MaxFilesPerReceipt - 1)]);
        await _alice.PostAsync($"/api/receipts/{receipt.Id}/files", fill, Ct);
        (await _alice.PostAsync($"{fileUrl}/restore", null, Ct)).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Trash_is_per_user()
    {
        var receipt = await CreateAsync();
        await _alice.DeleteAsync($"/api/receipts/{receipt.Id}", Ct);

        (await ListAsync(_bob, "/api/receipts/trash")).Should().BeEmpty();
        (await _bob.GetAsync($"/api/receipts/{receipt.Id}", Ct)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await _bob.PostAsync($"/api/receipts/{receipt.Id}/restore", null, Ct))
            .StatusCode.Should()
            .Be(HttpStatusCode.NotFound);
        await _bob.DeleteAsync($"/api/receipts/{receipt.Id}/permanent", Ct);
        (await ListAsync(_alice, "/api/receipts/trash")).Should().ContainSingle();
    }

    [Fact]
    public async Task Purge_removes_only_what_has_been_in_the_trash_long_enough()
    {
        var old = await CreateAsync(fileCount: 2);
        await _alice.DeleteAsync($"/api/receipts/{old.Id}", Ct);
        var kept = await CreateAsync(fileCount: 2);
        await _alice.DeleteAsync($"/api/receipts/{kept.Id}/files/{kept.Files[0].Id}", Ct);
        _factory.Time.Advance(TimeSpan.FromDays(2));
        var recent = await CreateAsync();
        await _alice.DeleteAsync($"/api/receipts/{recent.Id}", Ct);
        // Old and the removed file: a day past the limit. Recent: a day short of it.
        _factory.Time.Advance(TimeSpan.FromDays(ReceiptRules.TrashDays - 1));

        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var purged = await scope.ServiceProvider.GetRequiredService<TrashCleaner>().PurgeAsync(Ct);
            purged.Should().Be(2, "the old receipt and the removed file");
        }

        (await ListAsync(_alice, "/api/receipts/trash")).Should().ContainSingle().Which.Id.Should().Be(recent.Id);
        (await ListAsync(_alice)).Should().ContainSingle().Which.Files.Should().ContainSingle();
        (await _alice.PostAsync($"/api/receipts/{kept.Id}/files/{kept.Files[0].Id}/restore", null, Ct))
            .StatusCode.Should()
            .Be(HttpStatusCode.NotFound);
        Directory.GetFiles(FilesDir).Should().HaveCount(2, "kept's remaining file and recent's file");
    }

    [Fact]
    public async Task Purge_carries_on_when_a_stored_file_cannot_be_deleted()
    {
        var receipt = await CreateAsync(fileCount: 3);
        await _alice.DeleteAsync($"/api/receipts/{receipt.Id}", Ct);
        _factory.Time.Advance(TimeSpan.FromDays(ReceiptRules.TrashDays + 1));

        await using var scope = _factory.Services.CreateAsyncScope();
        var real = scope.ServiceProvider.GetRequiredService<IFileStore>();
        var failing = new FailingFileStore(real, failKey: $"{receipt.Files[0].Id:N}.pdf");
        var cleaner = new TrashCleaner(
            scope.ServiceProvider.GetRequiredService<AppDbContext>(),
            failing,
            _factory.Time,
            NullLogger<TrashCleaner>.Instance
        );
        var purged = await cleaner.PurgeAsync(Ct);

        purged.Should().Be(1);
        (await ListAsync(_alice, "/api/receipts/trash")).Should().BeEmpty();
        failing.Attempted.Should().HaveCount(3, "the failure doesn't stop the remaining files");
        Directory.GetFiles(FilesDir).Should().ContainSingle().Which.Should().EndWith(failing.FailKey);
    }

    /// <summary>Deletes through the real store, except one key that throws.</summary>
    private sealed class FailingFileStore(IFileStore inner, string failKey) : IFileStore
    {
        public string FailKey => failKey;

        public List<string> Attempted { get; } = [];

        public Task SaveAsync(string key, Stream content, CancellationToken cancellationToken) =>
            inner.SaveAsync(key, content, cancellationToken);

        public Task<Stream?> OpenReadAsync(string key, CancellationToken cancellationToken) =>
            inner.OpenReadAsync(key, cancellationToken);

        public Task DeleteAsync(string key, CancellationToken cancellationToken)
        {
            Attempted.Add(key);
            return key == failKey ? throw new IOException("Disk says no.") : inner.DeleteAsync(key, cancellationToken);
        }
    }
}
