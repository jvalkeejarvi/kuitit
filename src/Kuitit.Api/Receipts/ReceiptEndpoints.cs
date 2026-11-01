using Kuitit.Api.Auth;
using Kuitit.Api.Data;
using Kuitit.Api.Files;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kuitit.Api.Receipts;

internal static partial class ReceiptEndpoints
{
    public static void MapApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api").RequireAuthorization().RequireCsrfHeader();

        api.MapGet("/me", (ICurrentUser user) => new MeDto(user.Identity!.Email, user.Identity.Name)).WithName("GetMe");

        var receipts = api.MapGroup("/receipts").WithTags("Receipts");
        receipts.MapGet("/", ListAsync).WithName("ListReceipts");
        receipts.MapGet("/trash", ListTrashAsync).WithName("ListTrash");
        receipts.MapPost("/", CreateAsync).WithName("CreateReceipt").DisableAntiforgery();
        receipts.MapGet("/{id:guid}", GetAsync).WithName("GetReceipt");
        receipts.MapPut("/{id:guid}", UpdateAsync).WithName("UpdateReceipt");
        receipts.MapPost("/{id:guid}/files", AddFilesAsync).WithName("AddReceiptFiles").DisableAntiforgery();
        receipts.MapGet("/{id:guid}/files/{fileId:guid}", GetFileAsync).WithName("GetReceiptFile");
        receipts.MapDelete("/{id:guid}/files/{fileId:guid}", DeleteFileAsync).WithName("DeleteReceiptFile");
        receipts.MapPost("/{id:guid}/files/{fileId:guid}/restore", RestoreFileAsync).WithName("RestoreReceiptFile");
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
        receipts.MapPost("/{id:guid}/restore", RestoreAsync).WithName("RestoreReceipt");
        receipts.MapDelete("/{id:guid}/permanent", DeletePermanentlyAsync).WithName("DeleteReceiptPermanently");

        // Unknown API routes are 404s, not the SPA fallback.
        app.Map("/api/{**rest}", () => Results.NotFound()).ExcludeFromDescription();
    }

    private static async Task<Ok<ReceiptDto[]>> ListAsync(AppDbContext db, CancellationToken ct, bool archived = false)
    {
        var rows = await db
            .Receipts.Include(r => r.Files)
            .Where(r => archived ? r.ArchivedAt != null : r.ArchivedAt == null)
            // Receipts without a warranty last.
            .OrderBy(r => r.ExpiresOn == null)
            .ThenBy(r => r.ExpiresOn)
            .ThenBy(r => r.Name)
            .AsNoTracking()
            .ToListAsync(ct);
        return TypedResults.Ok(rows.Select(ReceiptDto.From).ToArray());
    }

    private static async Task<Results<Created<ReceiptDto>, ValidationProblem>> CreateAsync(
        [FromForm] string name,
        [FromForm] DateOnly purchasedOn,
        IFormFileCollection files,
        [FromForm] int? warrantyMonths,
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
        var details = ValidateDetails(name, store, description, purchasedOn, warrantyMonths, time, errors);
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
            Name = details.Name,
            Store = details.Store,
            Description = details.Description,
            CreatedAt = now,
        };
        receipt.SetWarranty(purchasedOn, warrantyMonths);
        db.Receipts.Add(receipt);

        await SaveFilesAsync(receipt, uploads, now, db, fileStore, ct);
        return TypedResults.Created($"/api/receipts/{receipt.Id}", ReceiptDto.From(receipt));
    }

    /// <summary>Also a trashed receipt (DeletedAt set), so it can be looked at before restoring or purging.</summary>
    private static async Task<Results<Ok<ReceiptDto>, NotFound>> GetAsync(
        Guid id,
        AppDbContext db,
        CancellationToken ct
    )
    {
        var receipt = await db
            .Receipts.IgnoreQueryFilters([AppDbContext.NotDeleted])
            .Include(r => r.Files)
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id, ct);
        return receipt is null ? TypedResults.NotFound() : TypedResults.Ok(ReceiptDto.From(receipt));
    }

    private static async Task<Results<Ok<ReceiptDto>, NotFound, ValidationProblem>> UpdateAsync(
        Guid id,
        UpdateReceiptRequest request,
        AppDbContext db,
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
        var details = ValidateDetails(
            request.Name,
            request.Store,
            request.Description,
            request.PurchasedOn,
            request.WarrantyMonths,
            time,
            errors
        );
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        receipt.Name = details.Name;
        receipt.Store = details.Store;
        receipt.Description = details.Description;
        receipt.SetWarranty(request.PurchasedOn, request.WarrantyMonths);
        await db.SaveChangesAsync(ct);
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
}
