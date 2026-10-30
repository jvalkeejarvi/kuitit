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
        bool Archived = false
    );

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
            new("Televisio", "Power", null, today.AddMonths(-10), 60, Image: true),
            new("Kahvinkeitin", "Tokmanni", null, today.AddMonths(-30), 24),
            new("Polkupyörä", null, "Tunturi, runkonumero TU123456", today.AddMonths(-1), 24),
            new("Porakone", "K-Rauta", null, today.AddMonths(-40), 36, Archived: true),
        ];

        foreach (var sample in samples)
        {
            var id = Guid.CreateVersion7();
            var extension = sample.Image ? ".png" : ".pdf";
            var content = sample.Image
                ? SampleFiles.Png(width: 300, height: 400)
                : SampleFiles.Pdf([sample.Name, sample.Store ?? "", $"{sample.PurchasedOn:d.M.yyyy}"]);
            var receipt = new Receipt
            {
                Id = id,
                OwnerIssuer = user.Issuer,
                OwnerSub = user.Subject,
                OwnerEmail = user.Email,
                Name = sample.Name,
                Store = sample.Store,
                Description = sample.Description,
                FileName = $"kuitti-{sample.Name.ToLowerInvariant().Replace(' ', '-')}{extension}",
                ContentType = sample.Image ? "image/png" : "application/pdf",
                StorageKey = $"{id:N}{extension}",
                SizeBytes = content.Length,
                CreatedAt = now,
                ArchivedAt = sample.Archived ? now : null,
            };
            receipt.SetWarranty(sample.PurchasedOn, sample.WarrantyMonths);

            using var stream = new MemoryStream(content);
            await files.SaveAsync(receipt.StorageKey, stream, ct);
            db.Receipts.Add(receipt);
        }

        await db.SaveChangesAsync(ct);
        return samples.Length;
    }
}
