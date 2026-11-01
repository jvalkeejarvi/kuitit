using Kuitit.Api.Data;
using Kuitit.Api.Files;

namespace Kuitit.Api.Receipts;

/// <summary>An uploaded file whose content has been checked.</summary>
internal sealed record ReceiptUpload(IFormFile File, DetectedFileType Type);

/// <summary>Stores uploaded files for a receipt: used by create and add-files.</summary>
internal sealed class ReceiptFileWriter(AppDbContext db, IFileStore fileStore, TimeProvider time)
{
    /// <summary>Writes the files, then the rows; files already written are removed if saving the rows fails.</summary>
    public async Task SaveAsync(Receipt receipt, IReadOnlyList<ReceiptUpload> uploads, CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var written = new List<string>();
        var position = receipt.Files.Count == 0 ? 0 : receipt.Files.Max(f => f.Position) + 1;
        try
        {
            foreach (var upload in uploads)
            {
                var id = Guid.CreateVersion7();
                var file = new ReceiptFile
                {
                    Id = id,
                    ReceiptId = receipt.Id,
                    FileName = SafeFileName(upload.File.FileName, upload.Type.Extension),
                    ContentType = upload.Type.ContentType,
                    StorageKey = $"{id:N}{upload.Type.Extension}",
                    SizeBytes = upload.File.Length,
                    Position = position++,
                    CreatedAt = now,
                };
                await using (var stream = upload.File.OpenReadStream())
                {
                    await fileStore.SaveAsync(file.StorageKey, stream, ct);
                }

                written.Add(file.StorageKey);
                receipt.Files.Add(file);
            }

            await db.SaveChangesAsync(ct);
        }
        catch
        {
            foreach (var key in written)
            {
                await fileStore.DeleteAsync(key, CancellationToken.None);
            }

            throw;
        }
    }

    /// <summary>Display name only; never used as a path.</summary>
    private static string SafeFileName(string fileName, string extension)
    {
        var name = Path.GetFileName(fileName.Replace('\\', '/')).Trim();
        name = new string([.. name.Where(c => !char.IsControl(c))]);
        if (name.Length == 0)
        {
            return "receipt" + extension;
        }

        return name.Length <= 255 ? name : name[..(255 - extension.Length)] + extension;
    }
}
