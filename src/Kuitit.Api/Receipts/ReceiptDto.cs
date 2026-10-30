using Kuitit.Api.Data;

namespace Kuitit.Api.Receipts;

public sealed record ReceiptDto(
    Guid Id,
    string Name,
    DateOnly PurchasedOn,
    int WarrantyMonths,
    DateOnly ExpiresOn,
    string FileName,
    string ContentType,
    long SizeBytes,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ArchivedAt
)
{
    public static ReceiptDto From(Receipt r) =>
        new(
            r.Id,
            r.Name,
            r.PurchasedOn,
            r.WarrantyMonths,
            r.ExpiresOn,
            r.FileName,
            r.ContentType,
            r.SizeBytes,
            r.CreatedAt,
            r.ArchivedAt
        );
}

public sealed record MeDto(string Email, string? Name);
