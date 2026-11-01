using Kuitit.Api.Auth;
using Kuitit.Api.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;

namespace Kuitit.Api.Tests;

public sealed class MigrationBackupTests : IDisposable
{
    private readonly string _dir = Path.Combine(Path.GetTempPath(), "kuitit-backup", Guid.NewGuid().ToString("N"));
    private readonly FakeTimeProvider _time = new(new DateTimeOffset(2026, 6, 15, 12, 0, 0, TimeSpan.Zero));

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public MigrationBackupTests() => Directory.CreateDirectory(_dir);

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        Directory.Delete(_dir, recursive: true);
    }

    private string DbPath => Path.Combine(_dir, "app.db");

    private string BackupDir => Path.Combine(_dir, MigrationBackup.FolderName);

    private AppDbContext CreateDb(string? path = null) =>
        new(
            new DbContextOptionsBuilder<AppDbContext>().UseSqlite($"Data Source={path ?? DbPath}").Options,
            new NoUser()
        );

    private Task<string?> BackupAsync(AppDbContext db) =>
        new MigrationBackup(db, _time, NullLogger<MigrationBackup>.Instance).CreateAsync(Ct);

    /// <summary>A database at the first migration, with the rest pending.</summary>
    private async Task<string> CreateOutdatedDbAsync(AppDbContext db)
    {
        var first = db.Database.GetMigrations().First();
        await db.GetService<IMigrator>().MigrateAsync(first, cancellationToken: Ct);
        await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;", Ct);
        return first;
    }

    [Fact]
    public async Task Pending_migrations_back_up_the_database_as_it_was()
    {
        await using var db = CreateDb();
        var first = await CreateOutdatedDbAsync(db);

        var path = await BackupAsync(db);

        Path.GetFileName(path).Should().Be($"app-20260615T120000Z-{first}.db");
        await using var backup = CreateDb(path);
        (await backup.Database.GetAppliedMigrationsAsync(Ct)).Should().Equal(first);
    }

    [Fact]
    public async Task No_backup_for_a_new_or_up_to_date_database()
    {
        await using var db = CreateDb();
        (await BackupAsync(db)).Should().BeNull();

        await db.Database.MigrateAsync(Ct);
        (await BackupAsync(db)).Should().BeNull();

        Directory.Exists(BackupDir).Should().BeFalse();
    }

    [Fact]
    public async Task Only_the_newest_backups_are_kept()
    {
        await using var db = CreateDb();
        await CreateOutdatedDbAsync(db);
        Directory.CreateDirectory(BackupDir);
        for (var i = 1; i <= MigrationBackup.Keep; i++)
        {
            await File.WriteAllTextAsync(Path.Combine(BackupDir, $"app-2026010{i}T000000Z-x.db"), "", Ct);
        }

        await File.WriteAllTextAsync(Path.Combine(BackupDir, "other.txt"), "", Ct);

        var path = await BackupAsync(db);

        Directory
            .GetFiles(BackupDir)
            .Select(Path.GetFileName)
            .Should()
            .BeEquivalentTo([
                "app-20260102T000000Z-x.db",
                "app-20260103T000000Z-x.db",
                "app-20260104T000000Z-x.db",
                "app-20260105T000000Z-x.db",
                Path.GetFileName(path),
                "other.txt",
            ]);
    }

    private sealed class NoUser : ICurrentUser
    {
        public UserIdentity? Identity => null;
    }
}
