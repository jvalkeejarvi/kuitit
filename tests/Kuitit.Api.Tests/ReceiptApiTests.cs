using System.Net;
using System.Net.Http.Json;
using Kuitit.Api.Receipts;

namespace Kuitit.Api.Tests;

public sealed class ReceiptApiTests : IAsyncLifetime
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

    private async Task<ReceiptDto> CreateAsync(HttpClient client, string name = "Laptop", byte[]? file = null)
    {
        var response = await client.PostAsync("/api/receipts", TestFiles.Form(name: name, file: file), Ct);
        response.StatusCode.Should().Be(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(Ct));
        return (await response.Content.ReadFromJsonAsync<ReceiptDto>(Ct))!;
    }

    private async Task<ReceiptDto[]> ListAsync(HttpClient client, bool archived = false) =>
        (await client.GetFromJsonAsync<ReceiptDto[]>($"/api/receipts?archived={archived}", Ct))!;

    [Fact]
    public async Task Anonymous_api_calls_get_401_not_a_redirect()
    {
        var anonymous = _factory.CreateClientFor(null);

        (await anonymous.GetAsync("/api/me", Ct)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await anonymous.GetAsync("/api/receipts", Ct)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Me_returns_the_signed_in_user()
    {
        var me = await _alice.GetFromJsonAsync<MeDto>("/api/me", Ct);

        me.Should().Be(new MeDto("alice@example.com", "alice"));
    }

    [Fact]
    public async Task Create_computes_expiry_from_purchase_date_and_warranty()
    {
        var response = await _alice.PostAsync(
            "/api/receipts",
            TestFiles.Form(name: "  Fridge  ", purchasedOn: "2025-08-31", warrantyMonths: "6"),
            Ct
        );

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var receipt = (await response.Content.ReadFromJsonAsync<ReceiptDto>(Ct))!;
        receipt.Name.Should().Be("Fridge");
        receipt.PurchasedOn.Should().Be(new DateOnly(2025, 8, 31));
        receipt.WarrantyMonths.Should().Be(6);
        receipt.ExpiresOn.Should().Be(new DateOnly(2026, 2, 28));
        receipt.ContentType.Should().Be("application/pdf");
        receipt.FileName.Should().Be("receipt.pdf");
        receipt.CreatedAt.Should().Be(_factory.Time.GetUtcNow());
        receipt.ArchivedAt.Should().BeNull();
        response.Headers.Location!.ToString().Should().Be($"/api/receipts/{receipt.Id}");
    }

    [Fact]
    public async Task List_is_sorted_by_expiry()
    {
        await _alice.PostAsync("/api/receipts", TestFiles.Form(name: "Later", warrantyMonths: "36"), Ct);
        await _alice.PostAsync("/api/receipts", TestFiles.Form(name: "Sooner", warrantyMonths: "12"), Ct);

        var receipts = await ListAsync(_alice);

        receipts.Select(r => r.Name).Should().Equal("Sooner", "Later");
    }

    [Fact]
    public async Task Users_never_see_each_others_receipts()
    {
        var receipt = await CreateAsync(_alice);

        (await ListAsync(_bob)).Should().BeEmpty();
        (await _bob.GetAsync($"/api/receipts/{receipt.Id}/file", Ct)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await _bob.PostAsync($"/api/receipts/{receipt.Id}/archive", null, Ct))
            .StatusCode.Should()
            .Be(HttpStatusCode.NotFound);
        (await _bob.DeleteAsync($"/api/receipts/{receipt.Id}", Ct)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await ListAsync(_alice)).Should().ContainSingle(r => r.Id == receipt.Id && r.ArchivedAt == null);
        (await _alice.GetAsync($"/api/receipts/{receipt.Id}/file", Ct)).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task File_is_served_inline_with_detected_content_type()
    {
        var receipt = await CreateAsync(_alice, file: TestFiles.Png);

        var response = await _alice.GetAsync($"/api/receipts/{receipt.Id}/file", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.Should().Be("image/png");
        response.Content.Headers.ContentDisposition!.DispositionType.Should().Be("inline");
        response.Headers.GetValues("X-Content-Type-Options").Should().Equal("nosniff");
        (await response.Content.ReadAsByteArrayAsync(Ct)).Should().Equal(TestFiles.Png);
    }

    [Theory]
    [InlineData("pdf", "application/pdf")]
    [InlineData("png", "image/png")]
    [InlineData("jpeg", "image/jpeg")]
    [InlineData("heic", "image/heic")]
    public async Task Accepts_allowed_file_types_by_content(string kind, string expectedType)
    {
        byte[] file = kind switch
        {
            "pdf" => TestFiles.Pdf,
            "png" => TestFiles.Png,
            "jpeg" => TestFiles.Jpeg,
            _ => TestFiles.Heic,
        };

        // Declared type is deliberately wrong; only the bytes count.
        var response = await _alice.PostAsync(
            "/api/receipts",
            TestFiles.Form(file: file, declaredType: "application/octet-stream"),
            Ct
        );

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        (await response.Content.ReadFromJsonAsync<ReceiptDto>(Ct))!.ContentType.Should().Be(expectedType);
    }

    [Fact]
    public async Task Rejects_files_whose_bytes_are_not_an_allowed_type()
    {
        var response = await _alice.PostAsync(
            "/api/receipts",
            TestFiles.Form(file: TestFiles.Text, fileName: "evil.pdf", declaredType: "application/pdf"),
            Ct
        );

        await ShouldBeValidationErrorAsync(response, "file");
    }

    [Theory]
    [InlineData("", "2026-01-10", "24", "name")]
    [InlineData("   ", "2026-01-10", "24", "name")]
    [InlineData("Laptop", "2026-06-17", "24", "purchasedOn")]
    [InlineData("Laptop", "2026-01-10", "0", "warrantyMonths")]
    [InlineData("Laptop", "2026-01-10", "601", "warrantyMonths")]
    public async Task Rejects_invalid_fields(string name, string purchasedOn, string warrantyMonths, string field)
    {
        var response = await _alice.PostAsync(
            "/api/receipts",
            TestFiles.Form(name: name, purchasedOn: purchasedOn, warrantyMonths: warrantyMonths),
            Ct
        );

        await ShouldBeValidationErrorAsync(response, field);
    }

    [Fact]
    public async Task Rejects_names_over_the_limit()
    {
        var response = await _alice.PostAsync(
            "/api/receipts",
            TestFiles.Form(name: new string('a', ReceiptRules.MaxNameLength + 1)),
            Ct
        );

        await ShouldBeValidationErrorAsync(response, "name");
    }

    [Fact]
    public async Task Rejects_empty_files()
    {
        var response = await _alice.PostAsync("/api/receipts", TestFiles.Form(file: []), Ct);

        await ShouldBeValidationErrorAsync(response, "file");
    }

    [Fact]
    public async Task Rejects_files_over_the_size_limit()
    {
        var huge = new byte[ReceiptRules.MaxFileBytes + 1];
        TestFiles.Pdf.CopyTo(huge, 0);

        var response = await _alice.PostAsync("/api/receipts", TestFiles.Form(file: huge), Ct);

        ((int)response.StatusCode).Should().BeInRange(400, 413);
        (await ListAsync(_alice)).Should().BeEmpty();
    }

    [Fact]
    public async Task Path_like_file_names_are_kept_only_as_display_names()
    {
        var response = await _alice.PostAsync("/api/receipts", TestFiles.Form(fileName: "../../etc/passwd.pdf"), Ct);

        var receipt = (await response.Content.ReadFromJsonAsync<ReceiptDto>(Ct))!;
        receipt.FileName.Should().Be("passwd.pdf");
        Directory
            .GetFiles(Path.Combine(_factory.DataDir, "files"))
            .Should()
            .ContainSingle()
            .Which.Should()
            .EndWith($"{receipt.Id:N}.pdf");
    }

    [Fact]
    public async Task Archive_and_unarchive_move_receipts_between_lists()
    {
        var receipt = await CreateAsync(_alice);

        var archived = await _alice.PostAsync($"/api/receipts/{receipt.Id}/archive", null, Ct);
        archived.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ListAsync(_alice)).Should().BeEmpty();
        (await ListAsync(_alice, archived: true))
            .Should()
            .ContainSingle()
            .Which.ArchivedAt.Should()
            .Be(_factory.Time.GetUtcNow());

        (await _alice.PostAsync($"/api/receipts/{receipt.Id}/unarchive", null, Ct))
            .StatusCode.Should()
            .Be(HttpStatusCode.OK);
        (await ListAsync(_alice)).Should().ContainSingle().Which.ArchivedAt.Should().BeNull();
        (await ListAsync(_alice, archived: true)).Should().BeEmpty();
    }

    [Fact]
    public async Task Archive_of_unknown_receipt_is_404()
    {
        var response = await _alice.PostAsync($"/api/receipts/{Guid.NewGuid()}/archive", null, Ct);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Delete_removes_row_and_file_and_is_idempotent()
    {
        var receipt = await CreateAsync(_alice);

        (await _alice.DeleteAsync($"/api/receipts/{receipt.Id}", Ct)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await _alice.DeleteAsync($"/api/receipts/{receipt.Id}", Ct)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await ListAsync(_alice)).Should().BeEmpty();
        Directory.GetFiles(Path.Combine(_factory.DataDir, "files")).Should().BeEmpty();
    }

    [Fact]
    public async Task Mutating_calls_without_csrf_header_are_rejected()
    {
        var client = _factory.CreateClientFor("alice");
        client.DefaultRequestHeaders.Remove("X-CSRF");

        var response = await client.PostAsync("/api/receipts", TestFiles.Form(), Ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ListAsync(_alice)).Should().BeEmpty();
    }

    [Fact]
    public async Task Unknown_api_routes_are_404()
    {
        (await _alice.GetAsync("/api/nope", Ct)).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private static async Task ShouldBeValidationErrorAsync(HttpResponseMessage response, string field)
    {
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblem>(Ct);
        problem!.Errors.Should().ContainKey(field);
    }

    private sealed record ValidationProblem(Dictionary<string, string[]> Errors);
}
