namespace Kuitit.Api.Tests;

/// <summary>Missing or invalid configuration stops the app at startup instead of failing requests later.</summary>
public sealed class StartupValidationTests
{
    [Theory]
    [InlineData("DATA_DIR", "", "DATA_DIR is not configured")]
    [InlineData("Auth:Authority", "", "The Authority field is required")]
    [InlineData("Auth:Authority", "not a url", "The Authority field is not a valid")]
    [InlineData("Auth:Authority", "http://idp.test", "must use HTTPS")]
    [InlineData("Auth:ClientId", "", "The ClientId field is required")]
    [InlineData("Auth:ClientSecret", "", "The ClientSecret field is required")]
    [InlineData("Auth:AllowedUsers:0", " ", "Auth:AllowedUsers must list at least one")]
    [InlineData("OTEL_EXPORTER_OTLP_ENDPOINT", "not a url", "OTEL_EXPORTER_OTLP_ENDPOINT is not an absolute URL")]
    public async Task Invalid_setting_fails_startup(string key, string value, string error)
    {
        await using var factory = new ApiFactory();

        var start = () => factory.WithWebHostBuilder(b => b.UseSetting(key, value)).CreateClient();

        start.Should().Throw<Exception>().Which.Message.Should().Contain(error);
    }

    [Fact]
    public async Task Valid_settings_start()
    {
        await using var factory = new ApiFactory();

        var start = () => factory.CreateClient();

        start.Should().NotThrow();
    }
}
