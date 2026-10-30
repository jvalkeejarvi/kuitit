using Microsoft.EntityFrameworkCore;

namespace Kuitit.Api.Data;

internal static class DatabaseSetup
{
    public static IServiceCollection AddAppDatabase(
        this IServiceCollection services,
        IConfiguration configuration,
        bool migrateOnStartup
    )
    {
        var provider = configuration["Database:Provider"] ?? "Sqlite";

        // Resolved per context so DATA_DIR is only needed when the app actually runs.
        services.AddDbContext<AppDbContext>(options =>
        {
            switch (provider)
            {
                case "Sqlite":
                    options.UseSqlite(
                        configuration.GetConnectionString("App")
                            ?? $"Data Source={Path.Combine(DataDir.Get(configuration), "app.db")}"
                    );
                    break;
                default:
                    throw new InvalidOperationException($"Unsupported Database:Provider '{provider}'.");
            }
        });
        if (migrateOnStartup)
        {
            services.AddHostedService<MigrationService>();
        }

        return services;
    }
}

/// <summary>Migrates on startup (single instance). A hosted service rather than code before app.Run, so tools
/// that build the host without running it (OpenAPI generation) don't touch the database. StartingAsync runs
/// before the server starts listening.</summary>
internal sealed class MigrationService(IServiceScopeFactory scopeFactory) : IHostedLifecycleService
{
    public async Task StartingAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync(cancellationToken);
        if (db.Database.IsSqlite())
        {
            await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;", cancellationToken);
        }
    }

    public Task StartAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    public Task StartedAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    public Task StoppingAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    public Task StoppedAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
