namespace Kuitit.Api.Receipts;

/// <summary>Runs <see cref="TrashCleaner.PurgeAsync"/> at start and then daily.</summary>
internal sealed class TrashPurger(IServiceScopeFactory scopeFactory, TimeProvider time, ILogger<TrashPurger> logger)
    : BackgroundService
{
    // Plenty for a 30-day retention, and rarely wakes hibernating disks.
    private static readonly TimeSpan _interval = TimeSpan.FromDays(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var purged = await scope.ServiceProvider.GetRequiredService<TrashCleaner>().PurgeAsync(stoppingToken);
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
}
