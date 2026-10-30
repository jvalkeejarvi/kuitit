using System.Net.Http.Headers;

namespace Kuitit.Api.Tests;

internal static class TestFiles
{
    public static readonly byte[] Pdf = [.. "%PDF-1.7\n%test\n"u8];
    public static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D];
    public static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 0x4A, 0x46, 0x49, 0x46];
    public static readonly byte[] Heic = [0, 0, 0, 0x18, .. "ftypheic"u8, 0, 0, 0, 0];
    public static readonly byte[] Text = [.. "hello, not a receipt"u8];

    public static MultipartFormDataContent Form(
        string name = "Laptop",
        string purchasedOn = "2026-01-10",
        string warrantyMonths = "24",
        byte[]? file = null,
        string fileName = "receipt.pdf",
        string declaredType = "application/pdf"
    )
    {
        var content = new ByteArrayContent(file ?? Pdf);
        content.Headers.ContentType = new MediaTypeHeaderValue(declaredType);
        return new MultipartFormDataContent
        {
            { new StringContent(name), "name" },
            { new StringContent(purchasedOn), "purchasedOn" },
            { new StringContent(warrantyMonths), "warrantyMonths" },
            { content, "file", fileName },
        };
    }
}
