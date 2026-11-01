using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Kuitit.Api.Data;

/// <summary>Query filters are in <see cref="AppDbContext"/>: they read the current user from the context.</summary>
internal sealed class ReceiptFileConfiguration : IEntityTypeConfiguration<ReceiptFile>
{
    public void Configure(EntityTypeBuilder<ReceiptFile> file)
    {
        file.HasKey(f => f.Id);
        // Ids are set by the app (v7), so a file added to a loaded receipt's collection is an insert.
        file.Property(f => f.Id).ValueGeneratedNever();
        file.Property(f => f.FileName).HasMaxLength(255);
        file.Property(f => f.ContentType).HasMaxLength(100);
        file.Property(f => f.StorageKey).HasMaxLength(100);
        // Stored as a number, as Receipt.DeletedAt.
        file.Property(f => f.DeletedAt).HasConversion(new DateTimeOffsetToBinaryConverter());
        file.HasIndex(f => f.DeletedAt);
    }
}
