using System.Net;

namespace Kuitit.Api.Tests;

public sealed class AuthEndpointTests : IAsyncLifetime
{
    private readonly ApiFactory _factory = new();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public ValueTask InitializeAsync() => ValueTask.CompletedTask;

    public ValueTask DisposeAsync() => _factory.DisposeAsync();

    [Fact]
    public async Task Login_challenges_the_idp_with_pkce()
    {
        var response = await _factory.CreateClientFor(null).GetAsync("/auth/login?returnUrl=/", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.Redirect);
        var location = response.Headers.Location!.ToString();
        location.Should().StartWith($"{ApiFactory.Issuer}/authorize?");
        location.Should().Contain("code_challenge_method=S256").And.NotContain("prompt=");
    }

    [Fact]
    public async Task Login_can_force_the_idp_to_ask_for_credentials()
    {
        var response = await _factory.CreateClientFor(null).GetAsync("/auth/login?prompt=login", Ct);

        response.Headers.Location!.ToString().Should().Contain("prompt=login");
    }

    [Fact]
    public async Task Logout_without_session_redirects_to_signed_out_page()
    {
        var response = await _factory.CreateClientFor(null).PostAsync("/auth/logout", null, Ct);

        response.StatusCode.Should().Be(HttpStatusCode.Redirect);
        response.Headers.Location!.ToString().Should().Be("/?signedOut=true");
    }
}
