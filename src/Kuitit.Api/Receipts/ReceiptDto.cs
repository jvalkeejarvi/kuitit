using Kuitit.Api.Data;

namespace Kuitit.Api.Receipts;

public sealed record ReceiptDto(
    Guid Id,
    string Name,
    string? Store,
    string? Description,
    DateOnly PurchasedOn,
    int WarrantyMonths,
    DateOnly ExpiresOn,
    ReceiptFileDto[] Files,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ArchivedAt
)
{
    public static ReceiptDto From(Receipt r) =>
        new(
            r.Id,
            r.Name,
            r.Store,
            r.Description,
            r.PurchasedOn,
            r.WarrantyMonths,
            r.ExpiresOn,
            [.. r.Files.OrderBy(f => f.Position).Select(ReceiptFileDto.From)],
            r.CreatedAt,
            r.ArchivedAt
        );
}

public sealed record ReceiptFileDto(Guid Id, string FileName, string ContentType, long SizeBytes)
{
    public static ReceiptFileDto From(ReceiptFile f) => new(f.Id, f.FileName, f.ContentType, f.SizeBytes);
}

public sealed record MeDto(string Email, string? Name);
