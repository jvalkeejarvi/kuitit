using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace Kuitit.Api.Auth;

internal static class AuthSetup
{
    public const string CsrfHeader = "X-CSRF";

    public static IServiceCollection AddAppAuth(this IServiceCollection services, IConfiguration configuration)
    {
        services
            .AddOptions<AuthOptions>()
            .Bind(configuration.GetSection(AuthOptions.SectionName))
            .ValidateDataAnnotations()
            .Validate(
                o => o.AllowedUsers.Any(a => !string.IsNullOrWhiteSpace(a)),
                "Auth:AllowedUsers must list at least one email or subject (or *)."
            )
            .ValidateOnStart();

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpContextCurrentUser>();

        services
            .AddAuthentication(o =>
            {
                o.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
                o.DefaultChallengeScheme = CookieAuthenticationDefaults.AuthenticationScheme;
            })
            .AddCookie(o =>
            {
                o.Cookie.Name = "kuitit";
                o.Cookie.HttpOnly = true;
                o.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                o.Cookie.SameSite = SameSiteMode.Lax;
                o.ExpireTimeSpan = TimeSpan.FromDays(14);
                o.SlidingExpiration = true;
                // The SPA handles 401/403 itself; never redirect API calls to a login page.
                o.Events.OnRedirectToLogin = ctx =>
                {
                    ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                o.Events.OnRedirectToAccessDenied = ctx =>
                {
                    ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };
            })
            .AddOpenIdConnect();

        services
            .AddOptions<OpenIdConnectOptions>(OpenIdConnectDefaults.AuthenticationScheme)
            .Configure<IOptions<AuthOptions>>((o, auth) => ConfigureOidc(o, auth.Value))
            .ValidateOnStart();

        services.AddAuthorization();
        return services;
    }

    private static void ConfigureOidc(OpenIdConnectOptions o, AuthOptions auth)
    {
        o.Authority = auth.Authority;
        o.ClientId = auth.ClientId;
        o.ClientSecret = auth.ClientSecret;
        o.RequireHttpsMetadata = auth.RequireHttpsMetadata;
        o.ResponseType = "code";
        o.UsePkce = true;
        // Synology SSO Server advertises no response_modes_supported (spec default: query) and only the openid,
        // email and groups scopes; asking for form_post or profile risks a rejected login.
        o.ResponseMode = OpenIdConnectResponseMode.Query;
        o.Scope.Clear();
        o.Scope.Add("openid");
        o.Scope.Add("email");
        o.MapInboundClaims = false;
        o.GetClaimsFromUserInfoEndpoint = true;
        // Synology has no `name`; its `username` (the DSM account) is the display fallback.
        o.ClaimActions.MapUniqueJsonKey(AppClaims.Username, AppClaims.Username);
        o.SaveTokens = true;
        o.TokenValidationParameters.NameClaimType = AppClaims.Name;
        o.Events.OnTokenValidated = ctx =>
        {
            var user = HttpContextCurrentUser.FromPrincipal(ctx.Principal);
            if (user is null || !auth.IsAllowed(user))
            {
                var logger = ctx.HttpContext.RequestServices.GetRequiredService<ILogger<AuthOptions>>();
                logger.LogWarning("Sign-in denied for {Email} ({Subject})", user?.Email, user?.Subject);
                ctx.Fail("User is not allowed.");
            }

            return Task.CompletedTask;
        };
        o.Events.OnRemoteFailure = ctx =>
        {
            ctx.Response.Redirect("/?authError=denied");
            ctx.HandleResponse();
            return Task.CompletedTask;
        };
    }

    /// <summary>Mutating API calls must carry a custom header. Browsers can't add one cross-origin without a CORS
    /// preflight (which is never allowed), so this blocks CSRF from sibling sites on the same NAS domain too.</summary>
    public static RouteGroupBuilder RequireCsrfHeader(this RouteGroupBuilder group) =>
        group.AddEndpointFilter(
            async (ctx, next) =>
            {
                var request = ctx.HttpContext.Request;
                if (
                    !HttpMethods.IsGet(request.Method)
                    && !HttpMethods.IsHead(request.Method)
                    && !request.Headers.ContainsKey(CsrfHeader)
                )
                {
                    return Results.Problem(
                        statusCode: StatusCodes.Status400BadRequest,
                        detail: $"Missing {CsrfHeader} header."
                    );
                }

                return await next(ctx);
            }
        );

    public static async Task<bool> HasEndSessionEndpointAsync(OpenIdConnectOptions options, CancellationToken ct)
    {
        if (options.ConfigurationManager is null)
        {
            return false;
        }

        var config = await options.ConfigurationManager.GetConfigurationAsync(ct);
        return !string.IsNullOrEmpty(config.EndSessionEndpoint);
    }

    public static AuthenticationProperties LoginProperties(string? returnUrl, bool forceLogin)
    {
        var properties = new OpenIdConnectChallengeProperties { RedirectUri = IsLocalUrl(returnUrl) ? returnUrl : "/" };
        if (forceLogin)
        {
            properties.Prompt = "login";
        }

        return properties;
    }

    /// <summary>Prevents open redirects: only app-relative paths.</summary>
    public static bool IsLocalUrl(string? url) =>
        !string.IsNullOrEmpty(url) && url[0] == '/' && (url.Length == 1 || (url[1] != '/' && url[1] != '\\'));
}
