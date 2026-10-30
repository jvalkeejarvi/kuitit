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
        string declaredType = "application/pdf",
        string? store = null,
        string? description = null,
        int fileCount = 1
    )
    {
        var form = new MultipartFormDataContent
        {
            { new StringContent(name), "name" },
            { new StringContent(purchasedOn), "purchasedOn" },
            { new StringContent(warrantyMonths), "warrantyMonths" },
        };
        for (var i = 0; i < fileCount; i++)
        {
            form.Add(File(file ?? Pdf, declaredType), "files", fileName);
        }

        if (store is not null)
        {
            form.Add(new StringContent(store), "store");
        }

        if (description is not null)
        {
            form.Add(new StringContent(description), "description");
        }

        return form;
    }

    /// <summary>Just files, for adding to an existing receipt.</summary>
    public static MultipartFormDataContent Files(params byte[][] files)
    {
        var form = new MultipartFormDataContent();
        foreach (var file in files)
        {
            form.Add(File(file, "application/octet-stream"), "files", "extra.bin");
        }

        return form;
    }

    private static ByteArrayContent File(byte[] bytes, string declaredType)
    {
        var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue(declaredType);
        return content;
    }
}
