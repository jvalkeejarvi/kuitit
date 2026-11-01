using Kuitit.Api.Data;

namespace Kuitit.Api.Receipts;

public sealed record ReceiptDto(
    Guid Id,
    string Name,
    string? Store,
    string? Description,
    DateOnly PurchasedOn,
    int? WarrantyMonths,
    DateOnly? ExpiresOn,
    ReceiptFileDto[] Files,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ArchivedAt,
    DateTimeOffset? DeletedAt
)
{
    public static ReceiptDto From(Receipt r) =>
        new(
            Id: r.Id,
            Name: r.Name,
            Store: r.Store,
            Description: r.Description,
            PurchasedOn: r.PurchasedOn,
            WarrantyMonths: r.WarrantyMonths,
            ExpiresOn: r.ExpiresOn,
            Files: [.. r.Files.Where(f => f.DeletedAt == null).OrderBy(f => f.Position).Select(ReceiptFileDto.From)],
            CreatedAt: r.CreatedAt,
            ArchivedAt: r.ArchivedAt,
            DeletedAt: r.DeletedAt
        );
}

public sealed record ReceiptFileDto(Guid Id, string FileName, string ContentType, long SizeBytes)
{
    public static ReceiptFileDto From(ReceiptFile f) => new(f.Id, f.FileName, f.ContentType, f.SizeBytes);
}

/// <summary>Everything editable after creation; files are managed through their own endpoints.</summary>
public sealed record UpdateReceiptRequest(
    string Name,
    string? Store,
    string? Description,
    DateOnly PurchasedOn,
    int? WarrantyMonths
);

public sealed record MeDto(string Email, string? Name);
