using System.Buffers.Binary;
using System.IO.Compression;
using System.Text;

namespace Kuitit.DevSeed;

/// <summary>Tiny but valid PDF and PNG files, so the app's magic-byte checks and previews behave as with uploads.</summary>
internal static class SampleFiles
{
    public static byte[] Pdf(IEnumerable<string> lines)
    {
        var text = new StringBuilder("BT /F1 18 Tf 50 780 Td 24 TL");
        foreach (var line in lines)
        {
            var escaped = line.Replace(@"\", @"\\").Replace("(", @"\(").Replace(")", @"\)");
            text.Append($" ({escaped}) Tj T*");
        }

        text.Append(" ET");
        string[] objects =
        [
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
                + "/Resources << /Font << /F1 5 0 R >> >> >>",
            $"<< /Length {Latin1(text.ToString()).Length} >>\nstream\n{text}\nendstream",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        ];

        var pdf = new StringBuilder("%PDF-1.7\n");
        var offsets = new List<int>();
        for (var i = 0; i < objects.Length; i++)
        {
            offsets.Add(Latin1(pdf.ToString()).Length);
            pdf.Append($"{i + 1} 0 obj\n{objects[i]}\nendobj\n");
        }

        var xref = Latin1(pdf.ToString()).Length;
        pdf.Append($"xref\n0 {objects.Length + 1}\n0000000000 65535 f \n");
        foreach (var offset in offsets)
        {
            pdf.Append($"{offset:D10} 00000 n \n");
        }

        pdf.Append($"trailer\n<< /Size {objects.Length + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
        return Latin1(pdf.ToString());
    }

    /// <summary>A grey gradient, RGB, 8 bits per channel.</summary>
    public static byte[] Png(int width, int height)
    {
        var raw = new byte[height * ((width * 3) + 1)];
        for (var y = 0; y < height; y++)
        {
            var row = y * ((width * 3) + 1);
            var shade = (byte)(230 - (y * 60 / height));
            raw.AsSpan(row + 1, width * 3).Fill(shade);
        }

        using var compressed = new MemoryStream();
        using (var zlib = new ZLibStream(compressed, CompressionLevel.Optimal, leaveOpen: true))
        {
            zlib.Write(raw);
        }

        var header = new byte[13];
        BinaryPrimitives.WriteInt32BigEndian(header, width);
        BinaryPrimitives.WriteInt32BigEndian(header.AsSpan(4), height);
        header[8] = 8; // bit depth
        header[9] = 2; // truecolour

        using var png = new MemoryStream();
        png.Write([0x89, (byte)'P', (byte)'N', (byte)'G', 0x0D, 0x0A, 0x1A, 0x0A]);
        WriteChunk(png, "IHDR", header);
        WriteChunk(png, "IDAT", compressed.ToArray());
        WriteChunk(png, "IEND", []);
        return png.ToArray();
    }

    private static byte[] Latin1(string value) => Encoding.Latin1.GetBytes(value);

    private static void WriteChunk(Stream stream, string type, byte[] data)
    {
        Span<byte> length = stackalloc byte[4];
        BinaryPrimitives.WriteInt32BigEndian(length, data.Length);
        stream.Write(length);
        var typeAndData = Encoding.ASCII.GetBytes(type).Concat(data).ToArray();
        stream.Write(typeAndData);
        Span<byte> crc = stackalloc byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(crc, Crc32(typeAndData));
        stream.Write(crc);
    }

    private static uint Crc32(byte[] data)
    {
        var crc = 0xFFFFFFFFu;
        foreach (var b in data)
        {
            crc ^= b;
            for (var bit = 0; bit < 8; bit++)
            {
                crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xEDB88320u : crc >> 1;
            }
        }

        return ~crc;
    }
}
