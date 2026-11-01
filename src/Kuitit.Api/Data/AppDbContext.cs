using Kuitit.Api.Auth;
using Microsoft.EntityFrameworkCore;

namespace Kuitit.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUser currentUser) : DbContext(options)
{
    public DbSet<Receipt> Receipts => Set<Receipt>();

    public DbSet<ReceiptFile> ReceiptFiles => Set<ReceiptFile>();

    public const string Owner = nameof(Owner);

    public const string NotDeleted = nameof(NotDeleted);

    private string? OwnerIssuer => currentUser.Identity?.Issuer;

    private string? OwnerSub => currentUser.Identity?.Subject;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // Filters stay here: they read the current user from this context instance.
        var receipt = modelBuilder.Entity<Receipt>();
        receipt.HasQueryFilter(Owner, r => r.OwnerIssuer == OwnerIssuer && r.OwnerSub == OwnerSub);
        receipt.HasQueryFilter(NotDeleted, r => r.DeletedAt == null);

        var file = modelBuilder.Entity<ReceiptFile>();
        // Same owner rule as receipts, so files can't be reached around it.
        file.HasQueryFilter(Owner, f => f.Receipt!.OwnerIssuer == OwnerIssuer && f.Receipt.OwnerSub == OwnerSub);
        // Files of a trashed receipt are hidden too, so they can't be opened from outside the trash.
        file.HasQueryFilter(NotDeleted, f => f.DeletedAt == null && f.Receipt!.DeletedAt == null);
    }
}
