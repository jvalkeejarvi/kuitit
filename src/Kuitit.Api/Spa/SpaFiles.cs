using Microsoft.AspNetCore.StaticFiles;

namespace Kuitit.Api.Spa;

/// <summary>
/// Cache headers for the built SPA. Vite puts a content hash in every file under /assets, so those never change
/// and can be cached for good. index.html must always be revalidated (cheap with its ETag): a stale copy would
/// point at hashed files a newer release no longer has.
/// </summary>
internal static class SpaFiles
{
    public static readonly StaticFileOptions Options = new() { OnPrepareResponse = SetCacheHeaders };

    public static void MapSpaFallback(this WebApplication app)
    {
        // The fallback only matches paths without a file extension, so a missing hashed file is a 404, not
        // index.html (which the client would then try to run as JS).
        app.MapFallbackToFile("index.html", Options);
    }

    private static void SetCacheHeaders(StaticFileResponseContext ctx)
    {
        var hashed =
            ctx.Context.Request.Path.StartsWithSegments("/assets")
            && !ctx.File.Name.Equals("index.html", StringComparison.OrdinalIgnoreCase);
        ctx.Context.Response.Headers.CacheControl = hashed ? "public, max-age=31536000, immutable" : "no-cache";
    }
}
