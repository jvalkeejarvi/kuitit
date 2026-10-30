namespace Kuitit.Api.Data;

public sealed class Receipt
{
    public Guid Id { get; init; }

    public required string OwnerIssuer { get; init; }

    public required string OwnerSub { get; init; }

    public required string OwnerEmail { get; set; }

    public required string Name { get; set; }

    public DateOnly PurchasedOn { get; set; }

    public int WarrantyMonths { get; set; }

    /// <summary>Derived from PurchasedOn + WarrantyMonths; stored so it can be sorted and filtered on.</summary>
    public DateOnly ExpiresOn { get; private set; }

    public required string FileName { get; init; }

    public required string ContentType { get; init; }

    public required string StorageKey { get; init; }

    public long SizeBytes { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset? ArchivedAt { get; set; }

    public void SetWarranty(DateOnly purchasedOn, int warrantyMonths)
    {
        PurchasedOn = purchasedOn;
        WarrantyMonths = warrantyMonths;
        ExpiresOn = purchasedOn.AddMonths(warrantyMonths);
    }
}
