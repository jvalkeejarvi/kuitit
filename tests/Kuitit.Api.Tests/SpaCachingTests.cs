using System.Net;

namespace Kuitit.Api.Tests;

public sealed class SpaCachingTests : IAsyncLifetime
{
    private readonly ApiFactory _factory = new();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public ValueTask InitializeAsync() => ValueTask.CompletedTask;

    public ValueTask DisposeAsync() => _factory.DisposeAsync();

    [Theory]
    [InlineData("/")]
    [InlineData("/index.html")]
    [InlineData("/receipts/01a18ec0-b5bb-7d08-a4d3-0855f838589c")]
    public async Task Index_html_is_always_revalidated(string path)
    {
        var response = await _factory.CreateClientFor(null).GetAsync(path, Ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.Should().Be("text/html");
        response.Headers.CacheControl!.NoCache.Should().BeTrue();
        response.Headers.ETag.Should().NotBeNull();
        var csp = response.Headers.GetValues("Content-Security-Policy").Should().ContainSingle().Subject;
        csp.Should().Contain("script-src 'self';").And.Contain($"form-action 'self' {ApiFactory.Issuer};");
    }

    [Fact]
    public async Task Hashed_assets_are_cached_for_good()
    {
        var response = await _factory.CreateClientFor(null).GetAsync("/assets/index-abc123.js", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var cache = response.Headers.CacheControl!;
        cache.Public.Should().BeTrue();
        cache.MaxAge.Should().Be(TimeSpan.FromDays(365));
        cache.Extensions.Should().ContainSingle(e => e.Name == "immutable");
    }

    [Fact]
    public async Task Missing_assets_are_404_not_the_spa()
    {
        var response = await _factory.CreateClientFor(null).GetAsync("/assets/index-gone.js", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Web_app_manifest_is_served_for_installing()
    {
        var response = await _factory.CreateClientFor(null).GetAsync("/manifest.webmanifest", Ct);

        // Static files are only served for known types, so this guards against a 404 for .webmanifest.
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/manifest+json");
        response.Headers.CacheControl!.NoCache.Should().BeTrue();
    }
}
