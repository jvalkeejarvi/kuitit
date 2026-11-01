namespace Kuitit.Api.Receipts;

public static class ReceiptRules
{
    public const int MaxNameLength = 200;

    public const int MaxStoreLength = 200;

    public const int MaxDescriptionLength = 2000;

    public const long MaxFileBytes = 20 * 1024 * 1024;

    public const int MaxFilesPerReceipt = 10;

    /// <summary>Deleted receipts and removed files are kept this long before they are purged.</summary>
    public const int TrashDays = 30;

    /// <summary>Total for one upload request (several files at once).</summary>
    public const long MaxUploadBytes = 60 * 1024 * 1024;

    public const int MinWarrantyMonths = 1;

    public const int MaxWarrantyMonths = 600;
}
