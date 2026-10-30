using System.Buffers;

namespace Kuitit.Api.Files;

internal sealed class LocalFileStore(string root) : IFileStore
{
    private static readonly SearchValues<char> _keyChars = SearchValues.Create(
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_."
    );

    public async Task SaveAsync(string key, Stream content, CancellationToken cancellationToken)
    {
        var path = PathFor(key);
        Directory.CreateDirectory(root);
        var temp = path + ".tmp";
        await using (var file = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        {
            await content.CopyToAsync(file, cancellationToken);
        }

        File.Move(temp, path);
    }

    public Task<Stream?> OpenReadAsync(string key, CancellationToken cancellationToken)
    {
        var path = PathFor(key);
        Stream? stream = File.Exists(path)
            ? new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, useAsync: true)
            : null;
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string key, CancellationToken cancellationToken)
    {
        try
        {
            // A missing file is already a no-op; a missing folder means the same thing.
            File.Delete(PathFor(key));
        }
        catch (DirectoryNotFoundException) { }

        return Task.CompletedTask;
    }

    private string PathFor(string key)
    {
        if (key.Length is 0 or > 100 || key.AsSpan().ContainsAnyExcept(_keyChars) || key.StartsWith('.'))
        {
            throw new ArgumentException($"Invalid storage key '{key}'.", nameof(key));
        }

        return Path.Combine(root, key);
    }
}
