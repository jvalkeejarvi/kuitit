using System.Security.Claims;
using Kuitit.Api.Auth;

namespace Kuitit.Api.Tests;

public sealed class AuthRulesTests
{
    private static readonly UserIdentity _user = new("https://idp", "sub-1", "Alice@Example.com", "Alice");

    [Fact]
    public void Empty_allowlist_denies_everyone()
    {
        new AuthOptions().IsAllowed(_user).Should().BeFalse();
    }

    [Fact]
    public void Blank_entries_never_match_a_user_without_email()
    {
        var noEmail = _user with { Email = "" };

        new AuthOptions { AllowedUsers = ["", " "] }
            .IsAllowed(noEmail)
            .Should()
            .BeFalse();
    }

    [Theory]
    [InlineData("alice@example.com", true)]
    [InlineData("sub-1", true)]
    [InlineData("*", true)]
    [InlineData("bob@example.com", false)]
    [InlineData("SUB-1", false)]
    public void Allowlist_matches_email_case_insensitively_or_exact_subject(string entry, bool allowed)
    {
        new AuthOptions { AllowedUsers = [entry] }
            .IsAllowed(_user)
            .Should()
            .Be(allowed);
    }

    [Theory]
    [InlineData("/", true)]
    [InlineData("/receipts?archived=true", true)]
    [InlineData("//evil.example", false)]
    [InlineData("/\\evil.example", false)]
    [InlineData("https://evil.example", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void Return_urls_must_be_local(string? url, bool local)
    {
        AuthSetup.IsLocalUrl(url).Should().Be(local);
    }

    [Fact]
    public void Display_name_falls_back_to_username_claim()
    {
        var principal = new ClaimsPrincipal(
            new ClaimsIdentity([new Claim("sub", "1026", null, "https://nas"), new Claim("username", "juuso")], "oidc")
        );

        var user = HttpContextCurrentUser.FromPrincipal(principal);

        user.Should().Be(new UserIdentity("https://nas", "1026", "", "juuso"));
    }
}
