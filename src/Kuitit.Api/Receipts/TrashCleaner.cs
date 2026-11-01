using Kuitit.Api.Data;
using Kuitit.Api.Files;
using Microsoft.EntityFrameworkCore;

namespace Kuitit.Api.Receipts;

/// <summary>Permanent deletion: the daily purge (<see cref="TrashPurger"/>) and "delete permanently".</summary>
internal sealed class TrashCleaner(
    AppDbContext db,
    IFileStore fileStore,
    TimeProvider time,
    ILogger<TrashCleaner> logger
)
{
    /// <summary>
    /// Everything deleted more than <see cref="ReceiptRules.TrashDays"/> days ago, for all users: a system task, so
    /// it ignores all query filters, owner included.
    /// </summary>
    public async Task<int> PurgeAsync(CancellationToken ct)
    {
        var cutoff = time.GetUtcNow().AddDays(-ReceiptRules.TrashDays);
        var receipts = await db
            .Receipts.IgnoreQueryFilters()
            .Include(r => r.Files)
            .Where(r => r.DeletedAt < cutoff)
            .ToListAsync(ct);
        var files = await db
            .ReceiptFiles.IgnoreQueryFilters()
            .Where(f => f.DeletedAt < cutoff && !receipts.Select(r => r.Id).Contains(f.ReceiptId))
            .ToListAsync(ct);
        await DeleteAsync(receipts, files, ct);
        return receipts.Count + files.Count;
    }

    /// <summary>
    /// Rows first, then the stored files: a leftover file is harmless (nothing points at it), a row pointing at a
    /// missing file is not. Each file is removed on its own, so one failure doesn't leave the rest behind; it is
    /// logged and stays on disk as an orphan.
    /// </summary>
    public async Task DeleteAsync(
        IReadOnlyCollection<Receipt> receipts,
        IReadOnlyCollection<ReceiptFile> files,
        CancellationToken ct
    )
    {
        db.Receipts.RemoveRange(receipts);
        db.ReceiptFiles.RemoveRange(files);
        await db.SaveChangesAsync(ct);
        foreach (var key in receipts.SelectMany(r => r.Files).Concat(files).Select(f => f.StorageKey))
        {
            try
            {
                await fileStore.DeleteAsync(key, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                if (logger.IsEnabled(LogLevel.Warning))
                {
                    logger.LogWarning(ex, "Could not delete stored file {StorageKey}; it is left as an orphan", key);
                }
            }
        }
    }
}
