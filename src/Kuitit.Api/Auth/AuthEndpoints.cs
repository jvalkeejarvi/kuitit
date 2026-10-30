using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;

namespace Kuitit.Api.Auth;

internal static class AuthEndpoints
{
    public static void MapAuth(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/auth").ExcludeFromDescription();

        auth.MapGet(
            "/login",
            (string? returnUrl) =>
                Results.Challenge(AuthSetup.LoginProperties(returnUrl), [OpenIdConnectDefaults.AuthenticationScheme])
        );

        // A form POST (top-level navigation) so the browser can follow the redirect to the IdP's end-session page.
        // SameSite=Lax keeps the cookie off cross-site POSTs, so a third party can't log the user out.
        auth.MapPost(
                "/logout",
                async (HttpContext http) =>
                {
                    var properties = new AuthenticationProperties { RedirectUri = "/" };
                    if (http.User.Identity?.IsAuthenticated == true && await AuthSetup.HasEndSessionEndpointAsync(http))
                    {
                        return Results.SignOut(
                            properties,
                            [
                                CookieAuthenticationDefaults.AuthenticationScheme,
                                OpenIdConnectDefaults.AuthenticationScheme,
                            ]
                        );
                    }

                    await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                    return Results.Redirect("/");
                }
            )
            .DisableAntiforgery();
    }
}
