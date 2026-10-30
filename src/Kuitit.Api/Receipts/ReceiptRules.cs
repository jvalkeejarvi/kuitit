namespace Kuitit.Api;

public static class ReceiptRules
{
    public const int MaxNameLength = 200;

    public const int MaxStoreLength = 200;

    public const int MaxDescriptionLength = 2000;

    public const long MaxFileBytes = 20 * 1024 * 1024;

    public const int MinWarrantyMonths = 1;

    public const int MaxWarrantyMonths = 600;
}
