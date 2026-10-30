namespace Kuitit.Api.Data;

public sealed class Receipt
{
    public Guid Id { get; init; }

    public required string OwnerIssuer { get; init; }

    public required string OwnerSub { get; init; }

    public required string OwnerEmail { get; set; }

    public required string Name { get; set; }

    public string? Store { get; set; }

    public string? Description { get; set; }

    public DateOnly PurchasedOn { get; set; }

    public int WarrantyMonths { get; set; }

    /// <summary>Derived from PurchasedOn + WarrantyMonths; stored so it can be sorted and filtered on.</summary>
    public DateOnly ExpiresOn { get; private set; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset? ArchivedAt { get; set; }

    /// <summary>In the trash since; purged for good after <see cref="ReceiptRules.TrashDays"/> days.</summary>
    public DateTimeOffset? DeletedAt { get; set; }

    /// <summary>At least one; see <see cref="ReceiptFile.Position"/> for the order.</summary>
    public List<ReceiptFile> Files { get; init; } = [];

    public void SetWarranty(DateOnly purchasedOn, int warrantyMonths)
    {
        PurchasedOn = purchasedOn;
        WarrantyMonths = warrantyMonths;
        ExpiresOn = purchasedOn.AddMonths(warrantyMonths);
    }
}
