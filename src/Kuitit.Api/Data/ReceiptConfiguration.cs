using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Kuitit.Api.Data;

/// <summary>Query filters are in <see cref="AppDbContext"/>: they read the current user from the context.</summary>
internal sealed class ReceiptConfiguration : IEntityTypeConfiguration<Receipt>
{
    public void Configure(EntityTypeBuilder<Receipt> receipt)
    {
        receipt.HasKey(r => r.Id);
        receipt.Property(r => r.Id).ValueGeneratedNever();
        receipt.Property(r => r.OwnerIssuer).HasMaxLength(500);
        receipt.Property(r => r.OwnerSub).HasMaxLength(200);
        receipt.Property(r => r.OwnerEmail).HasMaxLength(320);
        receipt.Property(r => r.Name).HasMaxLength(ReceiptRules.MaxNameLength);
        receipt.Property(r => r.Store).HasMaxLength(ReceiptRules.MaxStoreLength);
        receipt.Property(r => r.Description).HasMaxLength(ReceiptRules.MaxDescriptionLength);
        receipt.HasIndex(r => new { r.OwnerIssuer, r.OwnerSub });
        // Stored as a number: SQLite can't compare or sort DateTimeOffset text, and the trash needs both.
        receipt.Property(r => r.DeletedAt).HasConversion(new DateTimeOffsetToBinaryConverter());
        receipt.HasIndex(r => r.DeletedAt);
        receipt
            .HasMany(r => r.Files)
            .WithOne(f => f.Receipt)
            .HasForeignKey(f => f.ReceiptId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
