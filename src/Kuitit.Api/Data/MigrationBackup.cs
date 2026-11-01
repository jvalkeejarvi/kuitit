using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Kuitit.Api.Data;

/// <summary>
/// A copy of the SQLite database taken just before pending migrations run, so a bad migration or a rollback to the
/// previous release can be undone. Kept in `backups/` next to the database, newest <see cref="Keep"/> only.
/// </summary>
internal static class MigrationBackup
{
    public const int Keep = 5;

    public const string FolderName = "backups";

    /// <summary>The backup's path, or null when there is nothing to back up (no pending migrations, or a new
    /// database).</summary>
    public static async Task<string?> CreateAsync(
        AppDbContext db,
        TimeProvider time,
        ILogger logger,
        CancellationToken ct
    )
    {
        var dbPath = new SqliteConnectionStringBuilder(db.Database.GetConnectionString()).DataSource;
        if (!File.Exists(dbPath))
        {
            return null;
        }

        var applied = (await db.Database.GetAppliedMigrationsAsync(ct)).ToList();
        if (applied.Count == 0 || !(await db.Database.GetPendingMigrationsAsync(ct)).Any())
        {
            return null;
        }

        var dir = Path.Combine(Path.GetDirectoryName(Path.GetFullPath(dbPath))!, FolderName);
        Directory.CreateDirectory(dir);
        var prefix = Path.GetFileNameWithoutExtension(dbPath);
        // Timestamp first so names sort by age; the last applied migration says which release it restores to.
        var path = Path.Combine(dir, $"{prefix}-{time.GetUtcNow():yyyyMMdd'T'HHmmss'Z'}-{applied[^1]}.db");

        // A consistent snapshot that includes the WAL, as one self-contained file.
        await db.Database.ExecuteSqlAsync($"VACUUM INTO {path}", ct);
        if (logger.IsEnabled(LogLevel.Information))
        {
            logger.LogInformation("Backed up the database to {Path} before migrating", path);
        }

        foreach (var old in Directory.GetFiles(dir, $"{prefix}-*.db").Order(StringComparer.Ordinal).SkipLast(Keep))
        {
            File.Delete(old);
        }

        return path;
    }
}
