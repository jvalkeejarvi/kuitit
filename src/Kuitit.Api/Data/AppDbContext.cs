using Kuitit.Api.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Kuitit.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUser currentUser) : DbContext(options)
{
    public DbSet<Receipt> Receipts => Set<Receipt>();

    public DbSet<ReceiptFile> ReceiptFiles => Set<ReceiptFile>();

    /// <summary>
    /// Named query filters. <see cref="Owner"/> must never be ignored in request code; <see cref="NotDeleted"/>
    /// is ignored (IgnoreQueryFilters([NotDeleted])) only to look into the trash.
    /// </summary>
    public const string Owner = nameof(Owner);

    public const string NotDeleted = nameof(NotDeleted);

    // Read by the query filter on every query, so it reflects the user of the current scope.
    private string? OwnerIssuer => currentUser.Identity?.Issuer;

    private string? OwnerSub => currentUser.Identity?.Subject;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var receipt = modelBuilder.Entity<Receipt>();
        receipt.HasKey(r => r.Id);
        receipt.Property(r => r.Id).ValueGeneratedNever();
        receipt.Property(r => r.OwnerIssuer).HasMaxLength(500);
        receipt.Property(r => r.OwnerSub).HasMaxLength(200);
        receipt.Property(r => r.OwnerEmail).HasMaxLength(320);
        receipt.Property(r => r.Name).HasMaxLength(ReceiptRules.MaxNameLength);
        receipt.Property(r => r.Store).HasMaxLength(ReceiptRules.MaxStoreLength);
        receipt.Property(r => r.Description).HasMaxLength(ReceiptRules.MaxDescriptionLength);
        receipt.HasIndex(r => new { r.OwnerIssuer, r.OwnerSub });
        receipt.HasQueryFilter(Owner, r => r.OwnerIssuer == OwnerIssuer && r.OwnerSub == OwnerSub);
        receipt.HasQueryFilter(NotDeleted, r => r.DeletedAt == null);
        // Stored as a number: SQLite can't compare or sort DateTimeOffset text, and the trash needs both.
        receipt.Property(r => r.DeletedAt).HasConversion(new DateTimeOffsetToBinaryConverter());
        receipt.HasIndex(r => r.DeletedAt);
        receipt
            .HasMany(r => r.Files)
            .WithOne(f => f.Receipt)
            .HasForeignKey(f => f.ReceiptId)
            .OnDelete(DeleteBehavior.Cascade);

        var file = modelBuilder.Entity<ReceiptFile>();
        file.HasKey(f => f.Id);
        // Ids are set by the app (v7), so a file added to a loaded receipt's collection is an insert.
        file.Property(f => f.Id).ValueGeneratedNever();
        file.Property(f => f.FileName).HasMaxLength(255);
        file.Property(f => f.ContentType).HasMaxLength(100);
        file.Property(f => f.StorageKey).HasMaxLength(100);
        // Same owner rule as receipts, so files can't be reached around it.
        file.HasQueryFilter(Owner, f => f.Receipt!.OwnerIssuer == OwnerIssuer && f.Receipt.OwnerSub == OwnerSub);
        // Files of a trashed receipt are hidden too, so they can't be opened from outside the trash.
        file.HasQueryFilter(NotDeleted, f => f.DeletedAt == null && f.Receipt!.DeletedAt == null);
        file.Property(f => f.DeletedAt).HasConversion(new DateTimeOffsetToBinaryConverter());
        file.HasIndex(f => f.DeletedAt);
    }
}
