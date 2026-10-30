using Kuitit.Api.Data;
using Kuitit.Api.Files;
using Microsoft.EntityFrameworkCore;

namespace Kuitit.Api.Receipts;

/// <summary>Permanently removes receipts and files that have been in the trash for <see cref="ReceiptRules.TrashDays"/>.</summary>
internal sealed class TrashPurger(IServiceScopeFactory scopeFactory, TimeProvider time, ILogger<TrashPurger> logger)
    : BackgroundService
{
    // At start and then daily: plenty for a 30-day retention, and rarely wakes hibernating disks.
    private static readonly TimeSpan _interval = TimeSpan.FromDays(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var files = scope.ServiceProvider.GetRequiredService<IFileStore>();
                var cutoff = time.GetUtcNow().AddDays(-ReceiptRules.TrashDays);
                var purged = await PurgeAsync(cutoff, db, files, logger, stoppingToken);
                if (purged > 0 && logger.IsEnabled(LogLevel.Information))
                {
                    logger.LogInformation("Purged {Count} items from the trash", purged);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Purging the trash failed");
            }

            await Task.Delay(_interval, time, stoppingToken);
        }
    }

    /// <summary>
    /// Everything deleted before <paramref name="cutoff"/>, for all users: a system task, so it ignores all
    /// query filters, owner included.
    /// </summary>
    public static async Task<int> PurgeAsync(
        DateTimeOffset cutoff,
        AppDbContext db,
        IFileStore fileStore,
        ILogger logger,
        CancellationToken ct
    )
    {
        var receipts = await db
            .Receipts.IgnoreQueryFilters()
            .Include(r => r.Files)
            .Where(r => r.DeletedAt < cutoff)
            .ToListAsync(ct);
        var files = await db
            .ReceiptFiles.IgnoreQueryFilters()
            .Where(f => f.DeletedAt < cutoff && !receipts.Select(r => r.Id).Contains(f.ReceiptId))
            .ToListAsync(ct);
        await DeleteAsync(receipts, files, db, fileStore, logger, ct);
        return receipts.Count + files.Count;
    }

    /// <summary>
    /// Rows first, then the stored files: a leftover file is harmless (nothing points at it), a row pointing at a
    /// missing file is not. Each file is removed on its own, so one failure doesn't leave the rest behind; it is
    /// logged and stays on disk as an orphan.
    /// </summary>
    public static async Task DeleteAsync(
        IReadOnlyCollection<Receipt> receipts,
        IReadOnlyCollection<ReceiptFile> files,
        AppDbContext db,
        IFileStore fileStore,
        ILogger logger,
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
