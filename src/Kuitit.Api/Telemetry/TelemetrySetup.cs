using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;

namespace Kuitit.Api.Telemetry;

internal static class TelemetrySetup
{
    /// <summary>
    /// Traces, metrics and logs over OTLP. Export only happens when OTEL_EXPORTER_OTLP_ENDPOINT is set
    /// (Aspire sets it in dev); otherwise this stays inert.
    /// </summary>
    public static WebApplicationBuilder AddAppTelemetry(this WebApplicationBuilder builder)
    {
        builder.Logging.AddOpenTelemetry(o =>
        {
            o.IncludeFormattedMessage = true;
            o.IncludeScopes = true;
        });

        var otel = builder
            .Services.AddOpenTelemetry()
            .WithMetrics(m =>
                m.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddRuntimeInstrumentation()
            )
            .WithTracing(t =>
                t.AddAspNetCoreInstrumentation(o => o.Filter = ctx => !ctx.Request.Path.StartsWithSegments("/healthz"))
                    .AddHttpClientInstrumentation()
            );

        var endpoint = builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"];
        if (!string.IsNullOrWhiteSpace(endpoint))
        {
            if (!Uri.TryCreate(endpoint, UriKind.Absolute, out _))
            {
                throw new InvalidOperationException(
                    $"OTEL_EXPORTER_OTLP_ENDPOINT is not an absolute URL: '{endpoint}'."
                );
            }

            otel.UseOtlpExporter();
        }

        return builder;
    }
}
