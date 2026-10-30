using Kuitit.Api.Files;

namespace Kuitit.Api.Tests;

public sealed class FileSignatureTests
{
    [Fact]
    public void Detects_allowed_types()
    {
        FileSignature.Detect(TestFiles.Pdf)!.ContentType.Should().Be("application/pdf");
        FileSignature.Detect(TestFiles.Png)!.ContentType.Should().Be("image/png");
        FileSignature.Detect(TestFiles.Jpeg)!.ContentType.Should().Be("image/jpeg");
        FileSignature.Detect(TestFiles.Heic)!.ContentType.Should().Be("image/heic");
    }

    [Fact]
    public void Rejects_other_content()
    {
        FileSignature.Detect(TestFiles.Text).Should().BeNull();
        FileSignature.Detect([]).Should().BeNull();
        // MP4 is ISO BMFF too, but not an image brand.
        FileSignature.Detect([0, 0, 0, 0x18, .. "ftypisom"u8]).Should().BeNull();
    }
}
