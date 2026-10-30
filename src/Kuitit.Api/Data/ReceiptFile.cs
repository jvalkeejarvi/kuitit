namespace Kuitit.Api.Data;

public sealed class ReceiptFile
{
    public Guid Id { get; init; }

    public Guid ReceiptId { get; init; }

    public Receipt? Receipt { get; init; }

    /// <summary>Original name, for display and downloads only; never used as a path.</summary>
    public required string FileName { get; init; }

    /// <summary>Detected from the file's bytes, not taken from the upload.</summary>
    public required string ContentType { get; init; }

    public required string StorageKey { get; init; }

    public long SizeBytes { get; init; }

    /// <summary>Upload order within the receipt. (v7 ids only order by millisecond.)</summary>
    public int Position { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    /// <summary>Removed from the receipt (undoable) since; purged with the trash.</summary>
    public DateTimeOffset? DeletedAt { get; set; }
}
