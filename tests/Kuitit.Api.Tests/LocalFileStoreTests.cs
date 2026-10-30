using Kuitit.Api.Files;

namespace Kuitit.Api.Tests;

public sealed class LocalFileStoreTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "kuitit-store", Guid.NewGuid().ToString("N"));

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public void Dispose()
    {
        if (Directory.Exists(_root))
        {
            Directory.Delete(_root, recursive: true);
        }
    }

    [Fact]
    public async Task Deleting_a_missing_file_or_from_a_missing_folder_is_a_no_op()
    {
        var store = new LocalFileStore(_root);

        // The folder doesn't exist yet.
        await store.Invoking(s => s.DeleteAsync("gone.pdf", Ct)).Should().NotThrowAsync();

        using (var content = new MemoryStream([1, 2, 3]))
        {
            await store.SaveAsync("kept.pdf", content, Ct);
        }

        await store.Invoking(s => s.DeleteAsync("gone.pdf", Ct)).Should().NotThrowAsync();
        (await store.OpenReadAsync("kept.pdf", Ct)).Should().NotBeNull().And.Subject!.Dispose();
    }
}
