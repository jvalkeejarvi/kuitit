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
            // More of the everyday kind, so the list scrolls; spread over all expiry states.
            new("Astianpesukone", "Gigantti", "Electrolux EEM48321L", today.AddMonths(-20), 24),
            new("Jääkaappi", "Power", null, today.AddMonths(-14), 24),
            new("Pölynimuri", "Verkkokauppa.com", "Dyson V15 Detect", today.AddMonths(-11).AddDays(-20), 12),
            new("Kuulokkeet", "Clas Ohlson", null, today.AddMonths(-6), 24),
            new("Puhelin", "Elisa", "iPhone, IMEI 356938035643809", today.AddMonths(-23).AddDays(-15), 24),
            new("Mikroaaltouuni", "Tokmanni", null, today.AddMonths(-26), 24),
            new("Sähköhammasharja", "Prisma", null, today.AddMonths(-2), 24),
            new("Ruohonleikkuri", "Motonet", "Husqvarna LC 247", today.AddMonths(-17), 36),
            new("Kahvimylly", "Stockmann", null, today.AddMonths(-9), 12, Image: true),
            new("Talvirenkaat", "Vianor", "4 kpl, nastat", today.AddMonths(-13), 12),
            new("Työtuoli", "IKEA", "Markus", today.AddMonths(-50), 120),
            new("Tabletti", "Gigantti", null, today.AddMonths(-25), 24, Archived: true),
            new("Kamera", "Rajala", "Sony a6400 + 16-50 mm", today.AddMonths(-4), 24, Image: true, ExtraPdf: true),
            new("Sähköpotkulauta", "XXL", null, today.AddMonths(-12).AddDays(10), 12),
            new("Ilmalämpöpumppu", "Bauhaus", "Mitsubishi MSZ-LN35, asennus sis.", today.AddMonths(-8), 60),
            new("Kodinkoneiden lisäturva", "Gigantti", null, today.AddMonths(-19), 36),
            new("Sohva", "Sotka", "Kangasverhoilu, 3-istuttava", today.AddMonths(-27), 24),
            new(
                "Robotti-imuri",
                "Power",
                "Roborock S8.\nKäyttöohje: https://www.roborock.com/pages/support (kohta Lataus).",
                today.AddMonths(-5),
                24
            ),
            new("Näyttö", "Jimm's PC-Store", "27\" 4K", today.AddMonths(-15), 36),
            new("Ompelukone", "Tokmanni", null, today.AddMonths(-31), 24),
            new("Leivänpaahdin", "Prisma", null, today.AddMonths(-11).AddDays(-25), 12),
            new("Juoksukello", "Intersport", "Garmin Forerunner 265", today.AddMonths(-9), 24, Image: true),
            new("Lastenvaunut", "Babyshop", null, today.AddMonths(-21), 24),
            new("Kaiutin", "Verkkokauppa.com", "Sonos Era 100", today.AddMonths(-1).AddDays(-12), 24),
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
