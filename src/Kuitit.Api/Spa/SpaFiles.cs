using Microsoft.AspNetCore.StaticFiles;

namespace Kuitit.Api.Spa;

/// <summary>
/// Headers for the built SPA.
/// Cache: Vite puts a content hash in every file under /assets, so those never change and can be cached for good.
/// index.html must always be revalidated (cheap with its ETag): a stale copy would point at hashed files a newer
/// release no longer has.
/// CSP: pages may only load scripts, styles, images and API calls from the app itself.
/// </summary>
internal static class SpaFiles
{
    public static StaticFileOptions Create(string contentSecurityPolicy) =>
        new() { OnPrepareResponse = ctx => SetHeaders(ctx, contentSecurityPolicy) };

    /// <summary>
    /// form-action also allows the IdP: logging out posts a form that redirects to its end-session endpoint.
    /// frame-ancestors 'self' stops other sites framing the app (clickjacking).
    /// </summary>
    public static string ContentSecurityPolicy(string authority) =>
        string.Join(
            "; ",
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self'",
            "img-src 'self' data: blob:",
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            $"form-action 'self' {new Uri(authority).GetLeftPart(UriPartial.Authority)}",
            "frame-ancestors 'self'"
        );

    public static void MapSpaFallback(this WebApplication app, StaticFileOptions options)
    {
        // The fallback only matches paths without a file extension, so a missing hashed file is a 404, not
        // index.html (which the client would then try to run as JS).
        app.MapFallbackToFile("index.html", options);
    }

    private static void SetHeaders(StaticFileResponseContext ctx, string contentSecurityPolicy)
    {
        var html = ctx.File.Name.EndsWith(".html", StringComparison.OrdinalIgnoreCase);
        var hashed = ctx.Context.Request.Path.StartsWithSegments("/assets") && !html;
        ctx.Context.Response.Headers.CacheControl = hashed ? "public, max-age=31536000, immutable" : "no-cache";
        if (html)
        {
            ctx.Context.Response.Headers.ContentSecurityPolicy = contentSecurityPolicy;
        }
    }
}
