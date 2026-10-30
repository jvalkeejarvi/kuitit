namespace Kuitit.Api.Files;

public sealed record DetectedFileType(string ContentType, string Extension);

/// <summary>Identifies allowed uploads by their magic bytes; the declared content type is never trusted.</summary>
public static class FileSignature
{
    public const int HeaderLength = 16;

    private static readonly string[] _heicBrands = ["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"];

    public static DetectedFileType? Detect(ReadOnlySpan<byte> header)
    {
        if (header.StartsWith("%PDF-"u8))
        {
            return new("application/pdf", ".pdf");
        }

        if (header.StartsWith((ReadOnlySpan<byte>)[0xFF, 0xD8, 0xFF]))
        {
            return new("image/jpeg", ".jpg");
        }

        if (header.StartsWith((ReadOnlySpan<byte>)[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
        {
            return new("image/png", ".png");
        }

        // ISO BMFF: [size:4]["ftyp"][major brand:4]
        if (header.Length >= 12 && header[4..8].SequenceEqual("ftyp"u8))
        {
            var brand = System.Text.Encoding.ASCII.GetString(header[8..12]);
            if (_heicBrands.Contains(brand))
            {
                return new("image/heic", ".heic");
            }
        }

        return null;
    }
}
