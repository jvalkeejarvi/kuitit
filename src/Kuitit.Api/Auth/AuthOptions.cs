using System.ComponentModel.DataAnnotations;

namespace Kuitit.Api.Auth;

public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    /// <summary>OIDC issuer URL (discovery document at {Authority}/.well-known/openid-configuration).</summary>
    [Required]
    public string Authority { get; set; } = "";

    [Required]
    public string ClientId { get; set; } = "";

    public string? ClientSecret { get; set; }

    /// <summary>Only for local development against a plain-HTTP mock IdP.</summary>
    public bool RequireHttpsMetadata { get; set; } = true;

    /// <summary>Emails or subjects allowed to sign in. Empty denies everyone; "*" allows any authenticated
    /// user (local mock IdP only).</summary>
    public IList<string> AllowedUsers { get; init; } = [];

    public bool IsAllowed(UserIdentity user) =>
        AllowedUsers.Any(a =>
            a == "*"
            || string.Equals(a, user.Email, StringComparison.OrdinalIgnoreCase)
            || string.Equals(a, user.Subject, StringComparison.Ordinal)
        );
}
