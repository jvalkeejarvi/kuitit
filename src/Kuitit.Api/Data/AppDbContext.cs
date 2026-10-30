using Kuitit.Api.Auth;
using Microsoft.EntityFrameworkCore;

namespace Kuitit.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUser currentUser) : DbContext(options)
{
    public DbSet<Receipt> Receipts => Set<Receipt>();

    // Read by the query filter on every query, so it reflects the user of the current scope.
    private string? OwnerIssuer => currentUser.Identity?.Issuer;

    private string? OwnerSub => currentUser.Identity?.Subject;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var receipt = modelBuilder.Entity<Receipt>();
        receipt.HasKey(r => r.Id);
        receipt.Property(r => r.OwnerIssuer).HasMaxLength(500);
        receipt.Property(r => r.OwnerSub).HasMaxLength(200);
        receipt.Property(r => r.OwnerEmail).HasMaxLength(320);
        receipt.Property(r => r.Name).HasMaxLength(ReceiptRules.MaxNameLength);
        receipt.Property(r => r.FileName).HasMaxLength(255);
        receipt.Property(r => r.ContentType).HasMaxLength(100);
        receipt.Property(r => r.StorageKey).HasMaxLength(100);
        receipt.HasIndex(r => new { r.OwnerIssuer, r.OwnerSub });
        receipt.HasQueryFilter(r => r.OwnerIssuer == OwnerIssuer && r.OwnerSub == OwnerSub);
    }
}
