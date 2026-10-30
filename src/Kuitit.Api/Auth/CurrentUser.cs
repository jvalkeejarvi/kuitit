using System.Security.Claims;

namespace Kuitit.Api.Auth;

/// <summary>A user is identified by issuer + subject. Email is kept so owners can be remapped after an IdP move.</summary>
public sealed record UserIdentity(string Issuer, string Subject, string Email, string? Name);

public interface ICurrentUser
{
    UserIdentity? Identity { get; }
}

internal sealed class HttpContextCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public UserIdentity? Identity => FromPrincipal(accessor.HttpContext?.User);

    public static UserIdentity? FromPrincipal(ClaimsPrincipal? principal)
    {
        var sub = principal?.FindFirst(AppClaims.Subject);
        if (principal?.Identity?.IsAuthenticated != true || sub is null)
        {
            return null;
        }

        // The OIDC handler stamps every claim with the token issuer.
        return new UserIdentity(
            sub.Issuer,
            sub.Value,
            principal.FindFirst(AppClaims.Email)?.Value ?? "",
            principal.FindFirst(AppClaims.Name)?.Value ?? principal.FindFirst(AppClaims.Username)?.Value
        );
    }
}

public static class AppClaims
{
    public const string Subject = "sub";
    public const string Email = "email";
    public const string Name = "name";

    /// <summary>Synology SSO Server's account name; used when there is no `name`.</summary>
    public const string Username = "username";
}
