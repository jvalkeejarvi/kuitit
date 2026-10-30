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

        if (!string.IsNullOrWhiteSpace(builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]))
        {
            otel.UseOtlpExporter();
        }

        return builder;
    }
}
