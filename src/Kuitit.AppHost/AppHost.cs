var builder = DistributedApplication.CreateBuilder(args);

// Real OIDC flow locally: the login page accepts any username (= sub). Add {"email": "..."} in its claims box
// to test owner email. Issuer is http://localhost:{port}/default for both the browser and the API.
var oidc = builder
    .AddContainer("oidc", "ghcr.io/navikt/mock-oauth2-server", "6.1.4")
    .WithHttpEndpoint(port: 8090, targetPort: 8080, name: "http")
    .WithEnvironment("JSON_CONFIG", """{"interactiveLogin": true, "httpServer": "NettyWrapper"}""");
var oidcEndpoint = oidc.GetEndpoint("http");

var api = builder
    .AddProject<Projects.Kuitit_Api>("api")
    .WithEnvironment("DATA_DIR", Path.Combine(builder.AppHostDirectory, "..", "..", ".data"))
    .WithEnvironment("Auth__Authority", ReferenceExpression.Create($"{oidcEndpoint}/default"))
    .WithEnvironment("Auth__ClientId", "kuitit-dev")
    .WithEnvironment("Auth__ClientSecret", "dev-secret")
    .WithEnvironment("Auth__RequireHttpsMetadata", "false")
    .WithEnvironment("Auth__AllowedUsers__0", "*")
    .WithHttpHealthCheck("/healthz")
    .WaitFor(oidc);

builder
    .AddViteApp("web", "../../web")
    .WithBun()
    .WithEnvironment("API_URL", api.GetEndpoint("http"))
    .WithReference(api)
    .WaitFor(api);

builder.Build().Run();
