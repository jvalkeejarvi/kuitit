using System.ComponentModel.DataAnnotations;

namespace Kuitit.Api.Auth;

public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    /// <summary>OIDC issuer URL (discovery document at {Authority}/.well-known/openid-configuration).</summary>
    [Required, Url]
    public string Authority { get; set; } = "";

    [Required]
    public string ClientId { get; set; } = "";

    [Required]
    public string ClientSecret { get; set; } = "";

    /// <summary>Only for local development against a plain-HTTP mock IdP.</summary>
    public bool RequireHttpsMetadata { get; set; } = true;

    /// <summary>Emails or subjects allowed to sign in; at least one (checked at startup). "*" allows any
    /// authenticated user.</summary>
    public IList<string> AllowedUsers { get; init; } = [];

    public bool IsAllowed(UserIdentity user) =>
        AllowedUsers.Any(a =>
            !string.IsNullOrWhiteSpace(a)
            && (
                a == "*"
                || string.Equals(a, user.Email, StringComparison.OrdinalIgnoreCase)
                || string.Equals(a, user.Subject, StringComparison.Ordinal)
            )
        );
}
