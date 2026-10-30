using Kuitit.Api.Auth;
using Kuitit.Api.Data;
using Kuitit.Api.Files;

namespace Kuitit.DevSeed;

internal static class SampleReceipts
{
    public const string Subject = "dev";

    private sealed record Sample(
        string Name,
        string? Store,
        string? Description,
        DateOnly PurchasedOn,
        int WarrantyMonths,
        bool Image = false,
        bool Archived = false,
        bool ExtraPdf = false
    );

    private static async Task AddFileAsync(
        Receipt receipt,
        string fileName,
        string contentType,
        byte[] content,
        IFileStore files,
        DateTimeOffset now,
        CancellationToken ct
    )
    {
        var id = Guid.CreateVersion7();
        var file = new ReceiptFile
        {
            Id = id,
            ReceiptId = receipt.Id,
            FileName = fileName,
            ContentType = contentType,
            StorageKey = $"{id:N}{Path.GetExtension(fileName)}",
            SizeBytes = content.Length,
            Position = receipt.Files.Count,
            CreatedAt = now,
        };
        using var stream = new MemoryStream(content);
        await files.SaveAsync(file.StorageKey, stream, ct);
        receipt.Files.Add(file);
    }

    /// <summary>Dates are relative to today so every expiry state stays covered: expired, expiring soon, valid.</summary>
    public static async Task<int> SeedAsync(
        AppDbContext db,
        IFileStore files,
        UserIdentity user,
        TimeProvider time,
        CancellationToken ct
    )
    {
        var now = time.GetUtcNow();
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        Sample[] samples =
        [
            new(
                "Pesukone",
                "Gigantti",
                "Bosch Serie 6, sarjanumero WAX32M40SN-0001",
                today.AddDays(12).AddMonths(-24),
                24
            ),
            new(
                "Kannettava tietokone",
                "Verkkokauppa.com",
                "Lenovo ThinkPad X1 Carbon.\nLaajennettu takuu ostettu erikseen.",
                today.AddMonths(-3),
                36
            ),
            // Receipt PDF plus a photo of the warranty card.
            new("Televisio", "Power", null, today.AddMonths(-10), 60, Image: true, ExtraPdf: true),
            new("Kahvinkeitin", "Tokmanni", null, today.AddMonths(-30), 24),
            new("Polkupyörä", null, "Tunturi, runkonumero TU123456", today.AddMonths(-1), 24),
            new("Porakone", "K-Rauta", null, today.AddMonths(-40), 36, Archived: true),
        ];

        foreach (var sample in samples)
        {
            var receipt = new Receipt
            {
                Id = Guid.CreateVersion7(),
                OwnerIssuer = user.Issuer,
                OwnerSub = user.Subject,
                OwnerEmail = user.Email,
                Name = sample.Name,
                Store = sample.Store,
                Description = sample.Description,
                CreatedAt = now,
                ArchivedAt = sample.Archived ? now : null,
            };
            receipt.SetWarranty(sample.PurchasedOn, sample.WarrantyMonths);

            var slug = sample.Name.ToLowerInvariant().Replace(' ', '-');
            if (!sample.Image || sample.ExtraPdf)
            {
                byte[] pdf = SampleFiles.Pdf([sample.Name, sample.Store ?? "", $"{sample.PurchasedOn:d.M.yyyy}"]);
                await AddFileAsync(receipt, $"kuitti-{slug}.pdf", "application/pdf", pdf, files, now, ct);
            }

            if (sample.Image)
            {
                var png = SampleFiles.Png(width: 300, height: 400);
                await AddFileAsync(receipt, $"kuva-{slug}.png", "image/png", png, files, now, ct);
            }

            db.Receipts.Add(receipt);
        }

        await db.SaveChangesAsync(ct);
        return samples.Length;
    }
}
