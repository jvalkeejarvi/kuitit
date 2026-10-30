using Kuitit.Api.Auth;
using Kuitit.Api.Data;
using Kuitit.Api.Files;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;

namespace Kuitit.Api.Receipts;

internal static class ReceiptEndpoints
{
    public static void MapApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api").RequireAuthorization().RequireCsrfHeader();

        api.MapGet("/me", (ICurrentUser user) => new MeDto(user.Identity!.Email, user.Identity.Name)).WithName("GetMe");

        var receipts = api.MapGroup("/receipts").WithTags("Receipts");
        receipts.MapGet("/", ListAsync).WithName("ListReceipts");
        receipts.MapPost("/", CreateAsync).WithName("CreateReceipt").DisableAntiforgery();
        receipts.MapGet("/{id:guid}", GetAsync).WithName("GetReceipt");
        receipts.MapGet("/{id:guid}/file", GetFileAsync).WithName("GetReceiptFile");
        receipts
            .MapPost(
                "/{id:guid}/archive",
                (Guid id, AppDbContext db, TimeProvider time, CancellationToken ct) =>
                    SetArchivedAsync(id, time.GetUtcNow(), db, ct)
            )
            .WithName("ArchiveReceipt");
        receipts
            .MapPost(
                "/{id:guid}/unarchive",
                (Guid id, AppDbContext db, CancellationToken ct) => SetArchivedAsync(id, null, db, ct)
            )
            .WithName("UnarchiveReceipt");
        receipts.MapDelete("/{id:guid}", DeleteAsync).WithName("DeleteReceipt");

        // Unknown API routes are 404s, not the SPA fallback.
        app.Map("/api/{**rest}", () => Results.NotFound()).ExcludeFromDescription();
    }

    private static async Task<Ok<ReceiptDto[]>> ListAsync(AppDbContext db, CancellationToken ct, bool archived = false)
    {
        var rows = await db
            .Receipts.Where(r => archived ? r.ArchivedAt != null : r.ArchivedAt == null)
            .OrderBy(r => r.ExpiresOn)
            .ThenBy(r => r.Name)
            .ToListAsync(ct);
        return TypedResults.Ok(rows.Select(ReceiptDto.From).ToArray());
    }

    private static async Task<Results<Created<ReceiptDto>, ValidationProblem>> CreateAsync(
        [FromForm] string name,
        [FromForm] DateOnly purchasedOn,
        [FromForm] int warrantyMonths,
        IFormFile file,
        [FromForm] string? store,
        [FromForm] string? description,
        AppDbContext db,
        IFileStore files,
        ICurrentUser currentUser,
        TimeProvider time,
        CancellationToken ct
    )
    {
        var errors = new Dictionary<string, string[]>();
        name = name.Trim();
        if (name.Length == 0)
        {
            errors["name"] = ["Name is required."];
        }
        else if (name.Length > ReceiptRules.MaxNameLength)
        {
            errors["name"] = [$"Name must be at most {ReceiptRules.MaxNameLength} characters."];
        }

        store = NullIfBlank(store);
        if (store?.Length > ReceiptRules.MaxStoreLength)
        {
            errors["store"] = [$"Store must be at most {ReceiptRules.MaxStoreLength} characters."];
        }

        description = NullIfBlank(description);
        if (description?.Length > ReceiptRules.MaxDescriptionLength)
        {
            errors["description"] = [$"Description must be at most {ReceiptRules.MaxDescriptionLength} characters."];
        }

        // A day of slack: the client's local date can be ahead of UTC.
        if (purchasedOn > DateOnly.FromDateTime(time.GetUtcNow().UtcDateTime).AddDays(1))
        {
            errors["purchasedOn"] = ["Purchase date can't be in the future."];
        }

        if (warrantyMonths is < ReceiptRules.MinWarrantyMonths or > ReceiptRules.MaxWarrantyMonths)
        {
            errors["warrantyMonths"] =
            [
                $"Warranty must be {ReceiptRules.MinWarrantyMonths}-{ReceiptRules.MaxWarrantyMonths} months.",
            ];
        }

        DetectedFileType? type = null;
        if (file.Length == 0)
        {
            errors["file"] = ["File is empty."];
        }
        else if (file.Length > ReceiptRules.MaxFileBytes)
        {
            errors["file"] = ["File is too large."];
        }
        else
        {
            type = await DetectAsync(file, ct);
            if (type is null)
            {
                errors["file"] = ["Only PDF, JPEG, PNG and HEIC files are allowed."];
            }
        }

        if (errors.Count > 0 || type is null)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var user = currentUser.Identity!;
        var id = Guid.CreateVersion7();
        var receipt = new Receipt
        {
            Id = id,
            OwnerIssuer = user.Issuer,
            OwnerSub = user.Subject,
            OwnerEmail = user.Email,
            Name = name,
            Store = store,
            Description = description,
            FileName = SafeFileName(file.FileName, type.Extension),
            ContentType = type.ContentType,
            StorageKey = $"{id:N}{type.Extension}",
            SizeBytes = file.Length,
            CreatedAt = time.GetUtcNow(),
        };
        receipt.SetWarranty(purchasedOn, warrantyMonths);

        await using (var stream = file.OpenReadStream())
        {
            await files.SaveAsync(receipt.StorageKey, stream, ct);
        }

        db.Receipts.Add(receipt);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch
        {
            await files.DeleteAsync(receipt.StorageKey, CancellationToken.None);
            throw;
        }

        return TypedResults.Created($"/api/receipts/{id}", ReceiptDto.From(receipt));
    }

    private static async Task<Results<Ok<ReceiptDto>, NotFound>> GetAsync(
        Guid id,
        AppDbContext db,
        CancellationToken ct
    )
    {
        var receipt = await db.Receipts.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct);
        return receipt is null ? TypedResults.NotFound() : TypedResults.Ok(ReceiptDto.From(receipt));
    }

    private static async Task<Results<FileStreamHttpResult, NotFound>> GetFileAsync(
        Guid id,
        AppDbContext db,
        IFileStore files,
        HttpContext http,
        CancellationToken ct
    )
    {
        var receipt = await db.Receipts.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct);
        if (receipt is null)
        {
            return TypedResults.NotFound();
        }

        var stream = await files.OpenReadAsync(receipt.StorageKey, ct);
        if (stream is null)
        {
            return TypedResults.NotFound();
        }

        var disposition = new ContentDispositionHeaderValue("inline");
        disposition.SetHttpFileName(receipt.FileName);
        http.Response.Headers.ContentDisposition = disposition.ToString();
        http.Response.Headers.CacheControl = "private, max-age=3600";
        return TypedResults.Stream(stream, receipt.ContentType, enableRangeProcessing: true);
    }

    private static async Task<Results<Ok<ReceiptDto>, NotFound>> SetArchivedAsync(
        Guid id,
        DateTimeOffset? archivedAt,
        AppDbContext db,
        CancellationToken ct
    )
    {
        var receipt = await db.Receipts.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (receipt is null)
        {
            return TypedResults.NotFound();
        }

        receipt.ArchivedAt = archivedAt;
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(ReceiptDto.From(receipt));
    }

    private static async Task<NoContent> DeleteAsync(Guid id, AppDbContext db, IFileStore files, CancellationToken ct)
    {
        var receipt = await db.Receipts.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (receipt is not null)
        {
            db.Receipts.Remove(receipt);
            await db.SaveChangesAsync(ct);
            await files.DeleteAsync(receipt.StorageKey, ct);
        }

        return TypedResults.NoContent();
    }

    private static async Task<DetectedFileType?> DetectAsync(IFormFile file, CancellationToken ct)
    {
        var header = new byte[FileSignature.HeaderLength];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
        return FileSignature.Detect(header.AsSpan(0, read));
    }

    private static string? NullIfBlank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>Display name only; never used as a path.</summary>
    private static string SafeFileName(string fileName, string extension)
    {
        var name = Path.GetFileName(fileName.Replace('\\', '/')).Trim();
        name = new string([.. name.Where(c => !char.IsControl(c))]);
        if (name.Length == 0)
        {
            return "receipt" + extension;
        }

        return name.Length <= 255 ? name : name[..(255 - extension.Length)] + extension;
    }
}
