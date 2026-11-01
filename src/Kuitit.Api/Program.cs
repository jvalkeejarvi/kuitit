using System.Reflection;
using System.Text.Json.Serialization;
using Kuitit.Api;
using Kuitit.Api.Auth;
using Kuitit.Api.Data;
using Kuitit.Api.Files;
using Kuitit.Api.Receipts;
using Kuitit.Api.Spa;
using Kuitit.Api.Telemetry;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

// Build-time OpenAPI generation (Microsoft.Extensions.ApiDescription.Server) starts the host, so give it
// throwaway settings and keep it away from real data.
var isGeneratingOpenApi = Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";
if (isGeneratingOpenApi)
{
    builder.Configuration.AddInMemoryCollection(
        new Dictionary<string, string?>
        {
            ["DATA_DIR"] = Path.Combine(Path.GetTempPath(), "kuitit-openapi"),
            ["Auth:Authority"] = "https://openapi.invalid",
            ["Auth:ClientId"] = "openapi",
        }
    );
}

// Multipart overhead on top of the file itself.
const long maxRequestBytes = ReceiptRules.MaxUploadBytes + (1024 * 1024);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = maxRequestBytes);
builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = maxRequestBytes);

builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    // Behind the DSM reverse proxy. Without this the OIDC redirect URI is built as http:// and rejected.
    // The container port is only reachable through the proxy, so any proxy address is trusted.
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

builder.AddAppTelemetry();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddAppAuth(builder.Configuration);
builder.Services.AddAppDatabase(builder.Configuration);
if (!isGeneratingOpenApi)
{
    builder.Services.AddHostedService<TrashPurger>();
}
builder.Services.AddSingleton<IFileStore>(sp => new LocalFileStore(
    Path.Combine(DataDir.Get(sp.GetRequiredService<IConfiguration>()), "files")
));
builder
    .Services.AddDataProtection()
    .SetApplicationName("kuitit")
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(DataDir.Get(builder.Configuration), "keys")));

// Strict numbers so the OpenAPI schema says integer, not integer|string.
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.NumberHandling = JsonNumberHandling.Strict);
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.Use(
    (ctx, next) =>
    {
        ctx.Response.Headers.XContentTypeOptions = "nosniff";
        ctx.Response.Headers["Referrer-Policy"] = "same-origin";
        return next(ctx);
    }
);
app.UseDefaultFiles();
var spaFiles = SpaFiles.Create(SpaFiles.ContentSecurityPolicy(app.Configuration["Auth:Authority"]!));
app.UseStaticFiles(spaFiles);
app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi();
app.MapHealthChecks("/healthz");
app.MapAuth();
app.MapApi();
app.MapSpaFallback(spaFiles);

app.Run();

public partial class Program;
