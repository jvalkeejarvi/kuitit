using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace Kuitit.Api.Tests;

/// <summary>The real app with a temp DATA_DIR (SQLite + files) and a header-driven auth scheme.</summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public const string UserHeader = "X-Test-User";
    public const string Issuer = "https://idp.test";

    public string DataDir { get; } = Path.Combine(Path.GetTempPath(), "kuitit-tests", Guid.NewGuid().ToString("N"));

    public FakeTimeProvider Time { get; } = new(new DateTimeOffset(2026, 6, 15, 12, 0, 0, TimeSpan.Zero));

    public HttpClient CreateClientFor(string? user)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add("X-CSRF", "1");
        if (user is not null)
        {
            client.DefaultRequestHeaders.Add(UserHeader, user);
        }

        return client;
    }

    /// <summary>A minimal built SPA: index.html plus one hashed asset.</summary>
    private string CreateWebRoot()
    {
        var root = Path.Combine(DataDir, "wwwroot");
        Directory.CreateDirectory(Path.Combine(root, "assets"));
        File.WriteAllText(Path.Combine(root, "index.html"), "<!doctype html><title>Kuitit</title>");
        File.WriteAllText(Path.Combine(root, "assets", "index-abc123.js"), "console.log(1);");
        return root;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("DATA_DIR", DataDir);
        builder.UseWebRoot(CreateWebRoot());
        builder.UseSetting("Auth:Authority", Issuer);
        builder.UseSetting("Auth:ClientId", "tests");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Time);
            services
                .AddAuthentication()
                .AddScheme<AuthenticationSchemeOptions, HeaderAuthHandler>(HeaderAuthHandler.SchemeName, null);
            // Static IdP metadata so challenges work without a network call. Replaces the manager the OIDC
            // handler's own post-configure already created.
            services.PostConfigure<OpenIdConnectOptions>(
                OpenIdConnectDefaults.AuthenticationScheme,
                o =>
                    o.ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(
                        new OpenIdConnectConfiguration
                        {
                            Issuer = Issuer,
                            AuthorizationEndpoint = $"{Issuer}/authorize",
                            TokenEndpoint = $"{Issuer}/token",
                        }
                    )
            );
            services.PostConfigure<AuthenticationOptions>(o =>
            {
                o.DefaultScheme = HeaderAuthHandler.SchemeName;
                o.DefaultAuthenticateScheme = HeaderAuthHandler.SchemeName;
                o.DefaultChallengeScheme = HeaderAuthHandler.SchemeName;
            });
        });
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        if (Directory.Exists(DataDir))
        {
            Directory.Delete(DataDir, recursive: true);
        }
    }

    /// <summary>Authenticates as the user named in the header: sub = name, email = name@example.com.</summary>
    private sealed class HeaderAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder
    ) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        public const string SchemeName = "Test";

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Request.Headers.TryGetValue(UserHeader, out var user) || string.IsNullOrEmpty(user))
            {
                return Task.FromResult(AuthenticateResult.NoResult());
            }

            Claim[] claims =
            [
                new("sub", user!, ClaimValueTypes.String, Issuer),
                new("email", $"{user}@example.com", ClaimValueTypes.String, Issuer),
                new("name", user!, ClaimValueTypes.String, Issuer),
            ];
            var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName));
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName)));
        }
    }
}
