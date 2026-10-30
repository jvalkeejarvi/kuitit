using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;

namespace Kuitit.Api.Auth;

internal static class AuthEndpoints
{
    public static void MapAuth(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/auth").ExcludeFromDescription();

        // prompt=login forces the IdP to ask for credentials again (switching away from a denied account).
        auth.MapGet(
            "/login",
            (string? returnUrl, string? prompt) =>
                Results.Challenge(
                    AuthSetup.LoginProperties(returnUrl, forceLogin: prompt == "login"),
                    [OpenIdConnectDefaults.AuthenticationScheme]
                )
        );

        // Lands on a signed-out screen instead of the app, which would send the browser straight back to the IdP.
        const string signedOutUrl = "/?signedOut=true";

        // A form POST (top-level navigation) so the browser can follow the redirect to the IdP's end-session page.
        // SameSite=Lax keeps the cookie off cross-site POSTs, so a third party can't log the user out.
        auth.MapPost(
                "/logout",
                async (HttpContext http) =>
                {
                    var properties = new AuthenticationProperties { RedirectUri = signedOutUrl };
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
                    return Results.Redirect(signedOutUrl);
                }
            )
            .DisableAntiforgery();
    }
}
