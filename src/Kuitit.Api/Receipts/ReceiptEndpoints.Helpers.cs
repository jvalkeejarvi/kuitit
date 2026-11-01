using Kuitit.Api.Data;
using Kuitit.Api.Files;

namespace Kuitit.Api.Receipts;

internal static partial class ReceiptEndpoints
{
    private sealed record Details(string Name, string? Store, string? Description);

    /// <summary>Rules shared by create and update; trims, and adds problems to <paramref name="errors"/>.</summary>
    private static Details ValidateDetails(
        string name,
        string? store,
        string? description,
        DateOnly purchasedOn,
        int? warrantyMonths,
        TimeProvider time,
        Dictionary<string, string[]> errors
    )
    {
        name = name.Trim();
        if (name.Length == 0)
        {
            errors["name"] = ["Name is required."];
        }
        else if (name.Length > ReceiptRules.MaxNameLength)
        {
            errors["name"] = [$"Name must be at most {ReceiptRules.MaxNameLength} characters."];
        }

        store = NullIfBlank(store);
        if (store?.Length > ReceiptRules.MaxStoreLength)
        {
            errors["store"] = [$"Store must be at most {ReceiptRules.MaxStoreLength} characters."];
        }

        description = NullIfBlank(description);
        if (description?.Length > ReceiptRules.MaxDescriptionLength)
        {
            errors["description"] = [$"Description must be at most {ReceiptRules.MaxDescriptionLength} characters."];
        }

        // A day of slack: the client's local date can be ahead of UTC.
        if (purchasedOn > DateOnly.FromDateTime(time.GetUtcNow().UtcDateTime).AddDays(1))
        {
            errors["purchasedOn"] = ["Purchase date can't be in the future."];
        }

        if (warrantyMonths is < ReceiptRules.MinWarrantyMonths or > ReceiptRules.MaxWarrantyMonths)
        {
            errors["warrantyMonths"] =
            [
                $"Warranty must be {ReceiptRules.MinWarrantyMonths}-{ReceiptRules.MaxWarrantyMonths} months.",
            ];
        }

        return new Details(name, store, description);
    }

    private sealed record Upload(IFormFile File, DetectedFileType Type);

    /// <summary>Checks count, size and content (magic bytes) of every file; adds to <paramref name="errors"/>.</summary>
    private static async Task<List<Upload>> ValidateFilesAsync(
        IFormFileCollection files,
        int existingCount,
        Dictionary<string, string[]> errors,
        CancellationToken ct
    )
    {
        if (files.Count == 0)
        {
            errors["files"] = ["Add at least one file."];
            return [];
        }

        if (existingCount + files.Count > ReceiptRules.MaxFilesPerReceipt)
        {
            errors["files"] = [$"A receipt can have at most {ReceiptRules.MaxFilesPerReceipt} files."];
            return [];
        }

        var uploads = new List<Upload>();
        var problems = new List<string>();
        foreach (var file in files)
        {
            if (file.Length == 0)
            {
                problems.Add($"{file.FileName}: file is empty.");
            }
            else if (file.Length > ReceiptRules.MaxFileBytes)
            {
                problems.Add($"{file.FileName}: file is too large.");
            }
            else if (await DetectAsync(file, ct) is { } type)
            {
                uploads.Add(new Upload(file, type));
            }
            else
            {
                problems.Add($"{file.FileName}: only PDF, JPEG, PNG and HEIC files are allowed.");
            }
        }

        if (problems.Count > 0)
        {
            errors["files"] = [.. problems];
        }

        return uploads;
    }

    /// <summary>Writes the files, then the rows; files already written are removed if saving the rows fails.</summary>
    private static async Task SaveFilesAsync(
        Receipt receipt,
        List<Upload> uploads,
        DateTimeOffset now,
        AppDbContext db,
        IFileStore fileStore,
        CancellationToken ct
    )
    {
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

    private static async Task<DetectedFileType?> DetectAsync(IFormFile file, CancellationToken ct)
    {
        var header = new byte[FileSignature.HeaderLength];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
        return FileSignature.Detect(header.AsSpan(0, read));
    }

    private static string? NullIfBlank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

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
