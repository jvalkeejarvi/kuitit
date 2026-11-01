using Kuitit.Api.Data;
using Kuitit.Api.Files;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;

namespace Kuitit.Api.Receipts;

internal static partial class ReceiptEndpoints
{
    private static async Task<Results<Ok<ReceiptDto>, NotFound, ValidationProblem>> AddFilesAsync(
        Guid id,
        IFormFileCollection files,
        AppDbContext db,
        IFileStore fileStore,
        TimeProvider time,
        CancellationToken ct
    )
    {
        var receipt = await db.Receipts.Include(r => r.Files).FirstOrDefaultAsync(r => r.Id == id, ct);
        if (receipt is null)
        {
            return TypedResults.NotFound();
        }

        var errors = new Dictionary<string, string[]>();
        var uploads = await ValidateFilesAsync(files, receipt.Files.Count, errors, ct);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        await SaveFilesAsync(receipt, uploads, time.GetUtcNow(), db, fileStore, ct);
        return TypedResults.Ok(ReceiptDto.From(receipt));
    }

    private static async Task<Results<FileStreamHttpResult, NotFound>> GetFileAsync(
        Guid id,
        Guid fileId,
        AppDbContext db,
        IFileStore fileStore,
        HttpContext http,
        CancellationToken ct
    )
    {
        // Files of a trashed receipt can be viewed too; a removed file can't.
        var file = await db
            .ReceiptFiles.IgnoreQueryFilters([AppDbContext.NotDeleted])
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == fileId && f.ReceiptId == id && f.DeletedAt == null, ct);
        if (file is null)
        {
            return TypedResults.NotFound();
        }

        var stream = await fileStore.OpenReadAsync(file.StorageKey, ct);
        if (stream is null)
        {
            return TypedResults.NotFound();
        }

        var disposition = new ContentDispositionHeaderValue("inline");
        disposition.SetHttpFileName(file.FileName);
        http.Response.Headers.ContentDisposition = disposition.ToString();
        http.Response.Headers.CacheControl = "private, max-age=3600";
        return TypedResults.Stream(stream, file.ContentType, enableRangeProcessing: true);
    }

    /// <summary>Removes a file from the receipt; it stays restorable until the trash is purged.</summary>
    private static async Task<Results<Ok<ReceiptDto>, NotFound, ValidationProblem>> DeleteFileAsync(
        Guid id,
        Guid fileId,
        AppDbContext db,
        TimeProvider time,
        CancellationToken ct
    )
    {
        var receipt = await db.Receipts.Include(r => r.Files).FirstOrDefaultAsync(r => r.Id == id, ct);
        var file = receipt?.Files.FirstOrDefault(f => f.Id == fileId);
        if (receipt is null || file is null)
        {
            return TypedResults.NotFound();
        }

        if (receipt.Files.Count == 1)
        {
            return TypedResults.ValidationProblem(
                new Dictionary<string, string[]> { ["files"] = ["A receipt needs at least one file."] }
            );
        }

        file.DeletedAt = time.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(ReceiptDto.From(receipt));
    }

    private static async Task<Results<Ok<ReceiptDto>, NotFound, ValidationProblem>> RestoreFileAsync(
        Guid id,
        Guid fileId,
        AppDbContext db,
        CancellationToken ct
    )
    {
        // Only the file's own deletion is looked past; the receipt itself must not be in the trash.
        var receipt = await db
            .Receipts.IgnoreQueryFilters([AppDbContext.NotDeleted])
            .Include(r => r.Files)
            .FirstOrDefaultAsync(r => r.Id == id && r.DeletedAt == null, ct);
        var file = receipt?.Files.FirstOrDefault(f => f.Id == fileId);
        if (receipt is null || file is null)
        {
            return TypedResults.NotFound();
        }

        if (file.DeletedAt is not null)
        {
            if (receipt.Files.Count(f => f.DeletedAt == null) >= ReceiptRules.MaxFilesPerReceipt)
            {
                return TypedResults.ValidationProblem(
                    new Dictionary<string, string[]>
                    {
                        ["files"] = [$"A receipt can have at most {ReceiptRules.MaxFilesPerReceipt} files."],
                    }
                );
            }

            file.DeletedAt = null;
            await db.SaveChangesAsync(ct);
        }

        return TypedResults.Ok(ReceiptDto.From(receipt));
    }
}
