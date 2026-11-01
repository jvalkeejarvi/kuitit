using Kuitit.Api.Data;
using Kuitit.Api.Files;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Kuitit.Api.Receipts;

internal static partial class ReceiptEndpoints
{
    private static async Task<Ok<ReceiptDto[]>> ListTrashAsync(AppDbContext db, CancellationToken ct)
    {
        var rows = await db
            .Receipts.IgnoreQueryFilters([AppDbContext.NotDeleted])
            .Include(r => r.Files)
            .Where(r => r.DeletedAt != null)
            .OrderByDescending(r => r.DeletedAt)
            .AsNoTracking()
            .ToListAsync(ct);
        return TypedResults.Ok(rows.Select(ReceiptDto.From).ToArray());
    }

    /// <summary>Moves the receipt to the trash. Idempotent.</summary>
    private static async Task<NoContent> DeleteAsync(Guid id, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var receipt = await db.Receipts.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (receipt is not null)
        {
            receipt.DeletedAt = time.GetUtcNow();
            await db.SaveChangesAsync(ct);
        }

        return TypedResults.NoContent();
    }

    private static async Task<Results<Ok<ReceiptDto>, NotFound>> RestoreAsync(
        Guid id,
        AppDbContext db,
        CancellationToken ct
    )
    {
        var receipt = await db
            .Receipts.IgnoreQueryFilters([AppDbContext.NotDeleted])
            .Include(r => r.Files)
            .FirstOrDefaultAsync(r => r.Id == id, ct);
        if (receipt is null)
        {
            return TypedResults.NotFound();
        }

        receipt.DeletedAt = null;
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(ReceiptDto.From(receipt));
    }

    /// <summary>Deletes a receipt that is already in the trash, with all its files. Idempotent.</summary>
    private static async Task<NoContent> DeletePermanentlyAsync(
        Guid id,
        AppDbContext db,
        IFileStore fileStore,
        ILogger<TrashPurger> logger,
        CancellationToken ct
    )
    {
        var receipt = await db
            .Receipts.IgnoreQueryFilters([AppDbContext.NotDeleted])
            .Include(r => r.Files)
            .FirstOrDefaultAsync(r => r.Id == id && r.DeletedAt != null, ct);
        if (receipt is not null)
        {
            await TrashPurger.DeleteAsync([receipt], [], db, fileStore, logger, ct);
        }

        return TypedResults.NoContent();
    }
}
