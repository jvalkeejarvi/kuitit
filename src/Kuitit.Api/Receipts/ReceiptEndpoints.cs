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
        receipts.MapPost("/{id:guid}/files", AddFilesAsync).WithName("AddReceiptFiles").DisableAntiforgery();
        receipts.MapGet("/{id:guid}/files/{fileId:guid}", GetFileAsync).WithName("GetReceiptFile");
        receipts.MapDelete("/{id:guid}/files/{fileId:guid}", DeleteFileAsync).WithName("DeleteReceiptFile");
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
            .Receipts.Include(r => r.Files)
            .Where(r => archived ? r.ArchivedAt != null : r.ArchivedAt == null)
            .OrderBy(r => r.ExpiresOn)
            .ThenBy(r => r.Name)
            .AsNoTracking()
            .ToListAsync(ct);
        return TypedResults.Ok(rows.Select(ReceiptDto.From).ToArray());
    }

    private static async Task<Results<Created<ReceiptDto>, ValidationProblem>> CreateAsync(
        [FromForm] string name,
        [FromForm] DateOnly purchasedOn,
        [FromForm] int warrantyMonths,
        IFormFileCollection files,
        [FromForm] string? store,
        [FromForm] string? description,
        AppDbContext db,
        IFileStore fileStore,
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

        var uploads = await ValidateFilesAsync(files, existingCount: 0, errors, ct);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var user = currentUser.Identity!;
        var now = time.GetUtcNow();
        var receipt = new Receipt
        {
            Id = Guid.CreateVersion7(),
            OwnerIssuer = user.Issuer,
            OwnerSub = user.Subject,
            OwnerEmail = user.Email,
            Name = name,
            Store = store,
            Description = description,
            CreatedAt = now,
        };
        receipt.SetWarranty(purchasedOn, warrantyMonths);
        db.Receipts.Add(receipt);

        await SaveFilesAsync(receipt, uploads, now, db, fileStore, ct);
        return TypedResults.Created($"/api/receipts/{receipt.Id}", ReceiptDto.From(receipt));
    }

    private static async Task<Results<Ok<ReceiptDto>, NotFound>> GetAsync(
        Guid id,
        AppDbContext db,
        CancellationToken ct
    )
    {
        var receipt = await db.Receipts.Include(r => r.Files).AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct);
        return receipt is null ? TypedResults.NotFound() : TypedResults.Ok(ReceiptDto.From(receipt));
    }

    private static async Task<Results<Ok<ReceiptDto>, NotFound, ValidationProblem>> AddFilesAsync(
        Guid id,
        IFormFileCollection files,
        AppDbContext db,
        IFileStore fileStore,
        TimeProvider time,
        CancellationToken ct
    )
    {
        var receipt = await db.Receipts.Include(r => r.Files).FirstOrDefaultAsync(r => r.Id == id, ct);
        if (receipt is null)
        {
            return TypedResults.NotFound();
        }

        var errors = new Dictionary<string, string[]>();
        var uploads = await ValidateFilesAsync(files, receipt.Files.Count, errors, ct);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        await SaveFilesAsync(receipt, uploads, time.GetUtcNow(), db, fileStore, ct);
        return TypedResults.Ok(ReceiptDto.From(receipt));
    }

    private static async Task<Results<FileStreamHttpResult, NotFound>> GetFileAsync(
        Guid id,
        Guid fileId,
        AppDbContext db,
        IFileStore fileStore,
        HttpContext http,
        CancellationToken ct
    )
    {
        var file = await db
            .ReceiptFiles.AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == fileId && f.ReceiptId == id, ct);
        if (file is null)
        {
            return TypedResults.NotFound();
        }

        var stream = await fileStore.OpenReadAsync(file.StorageKey, ct);
        if (stream is null)
        {
            return TypedResults.NotFound();
        }

        var disposition = new ContentDispositionHeaderValue("inline");
        disposition.SetHttpFileName(file.FileName);
        http.Response.Headers.ContentDisposition = disposition.ToString();
        http.Response.Headers.CacheControl = "private, max-age=3600";
        return TypedResults.Stream(stream, file.ContentType, enableRangeProcessing: true);
    }

    private static async Task<Results<Ok<ReceiptDto>, NotFound, ValidationProblem>> DeleteFileAsync(
        Guid id,
        Guid fileId,
        AppDbContext db,
        IFileStore fileStore,
        CancellationToken ct
    )
    {
        var receipt = await db.Receipts.Include(r => r.Files).FirstOrDefaultAsync(r => r.Id == id, ct);
        var file = receipt?.Files.FirstOrDefault(f => f.Id == fileId);
        if (receipt is null || file is null)
        {
            return TypedResults.NotFound();
        }

        if (receipt.Files.Count == 1)
        {
            return TypedResults.ValidationProblem(
                new Dictionary<string, string[]> { ["files"] = ["A receipt needs at least one file."] }
            );
        }

        receipt.Files.Remove(file);
        await db.SaveChangesAsync(ct);
        await fileStore.DeleteAsync(file.StorageKey, ct);
        return TypedResults.Ok(ReceiptDto.From(receipt));
    }

    private static async Task<Results<Ok<ReceiptDto>, NotFound>> SetArchivedAsync(
        Guid id,
        DateTimeOffset? archivedAt,
        AppDbContext db,
        CancellationToken ct
    )
    {
        var receipt = await db.Receipts.Include(r => r.Files).FirstOrDefaultAsync(r => r.Id == id, ct);
        if (receipt is null)
        {
            return TypedResults.NotFound();
        }

        receipt.ArchivedAt = archivedAt;
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(ReceiptDto.From(receipt));
    }

    private static async Task<NoContent> DeleteAsync(
        Guid id,
        AppDbContext db,
        IFileStore fileStore,
        CancellationToken ct
    )
    {
        var receipt = await db.Receipts.Include(r => r.Files).FirstOrDefaultAsync(r => r.Id == id, ct);
        if (receipt is not null)
        {
            db.Receipts.Remove(receipt);
            await db.SaveChangesAsync(ct);
            foreach (var file in receipt.Files)
            {
                await fileStore.DeleteAsync(file.StorageKey, ct);
            }
        }

        return TypedResults.NoContent();
    }

    private sealed record Upload(IFormFile File, DetectedFileType Type);

    /// <summary>Checks count, size and content (magic bytes) of every file; adds to <paramref name="errors"/>.</summary>
    private static async Task<List<Upload>> ValidateFilesAsync(
        IFormFileCollection files,
        int existingCount,
        Dictionary<string, string[]> errors,
        CancellationToken ct
    )
    {
        if (files.Count == 0)
        {
            errors["files"] = ["Add at least one file."];
            return [];
        }

        if (existingCount + files.Count > ReceiptRules.MaxFilesPerReceipt)
        {
            errors["files"] = [$"A receipt can have at most {ReceiptRules.MaxFilesPerReceipt} files."];
            return [];
        }

        var uploads = new List<Upload>();
        var problems = new List<string>();
        foreach (var file in files)
        {
            if (file.Length == 0)
            {
                problems.Add($"{file.FileName}: file is empty.");
            }
            else if (file.Length > ReceiptRules.MaxFileBytes)
            {
                problems.Add($"{file.FileName}: file is too large.");
            }
            else if (await DetectAsync(file, ct) is { } type)
            {
                uploads.Add(new Upload(file, type));
            }
            else
            {
                problems.Add($"{file.FileName}: only PDF, JPEG, PNG and HEIC files are allowed.");
            }
        }

        if (problems.Count > 0)
        {
            errors["files"] = [.. problems];
        }

        return uploads;
    }

    /// <summary>Writes the files, then the rows; files already written are removed if saving the rows fails.</summary>
    private static async Task SaveFilesAsync(
        Receipt receipt,
        List<Upload> uploads,
        DateTimeOffset now,
        AppDbContext db,
        IFileStore fileStore,
        CancellationToken ct
    )
    {
        var written = new List<string>();
        var position = receipt.Files.Count == 0 ? 0 : receipt.Files.Max(f => f.Position) + 1;
        try
        {
            foreach (var upload in uploads)
            {
                var id = Guid.CreateVersion7();
                var file = new ReceiptFile
                {
                    Id = id,
                    ReceiptId = receipt.Id,
                    FileName = SafeFileName(upload.File.FileName, upload.Type.Extension),
                    ContentType = upload.Type.ContentType,
                    StorageKey = $"{id:N}{upload.Type.Extension}",
                    SizeBytes = upload.File.Length,
                    Position = position++,
                    CreatedAt = now,
                };
                await using (var stream = upload.File.OpenReadStream())
                {
                    await fileStore.SaveAsync(file.StorageKey, stream, ct);
                }

                written.Add(file.StorageKey);
                receipt.Files.Add(file);
            }

            await db.SaveChangesAsync(ct);
        }
        catch
        {
            foreach (var key in written)
            {
                await fileStore.DeleteAsync(key, CancellationToken.None);
            }

            throw;
        }
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
