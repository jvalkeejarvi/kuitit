var builder = DistributedApplication.CreateBuilder(args);

// Real OIDC flow locally: the login page accepts any username (= sub). Add {"email": "..."} in its claims box
// to test owner email. Issuer is http://localhost:{port}/default for both the browser and the API.
var oidc = builder
    .AddContainer("oidc", "ghcr.io/navikt/mock-oauth2-server", "6.1.4")
    .WithHttpEndpoint(port: 8090, targetPort: 8080, name: "http")
    .WithEnvironment("JSON_CONFIG", """{"interactiveLogin": true, "httpServer": "NettyWrapper"}""");
var oidcEndpoint = oidc.GetEndpoint("http");

var dataDir = Path.Combine(builder.AppHostDirectory, "..", "..", ".data");
var authority = ReferenceExpression.Create($"{oidcEndpoint}/default");

var api = builder
    .AddProject<Projects.Kuitit_Api>("api")
    .WithEnvironment("DATA_DIR", dataDir)
    .WithEnvironment("Auth__Authority", authority)
    .WithEnvironment("Auth__ClientId", "kuitit-dev")
    .WithEnvironment("Auth__ClientSecret", "dev-secret")
    .WithEnvironment("Auth__RequireHttpsMetadata", "false")
    .WithEnvironment("Auth__AllowedUsers__0", "*")
    .WithHttpHealthCheck("/healthz")
    .WaitFor(oidc);

// Sample receipts for the mock IdP user `dev`, once the API has migrated. Skipped when `dev` already has data.
builder
    .AddProject<Projects.Kuitit_DevSeed>("seed")
    .WithEnvironment("DATA_DIR", dataDir)
    // The mock IdP's issuer is the API's authority; seeded receipts need it to belong to `dev`.
    .WithEnvironment("SEED_ISSUER", authority)
    .WaitFor(api);

builder
    .AddViteApp("web", "../../web")
    .WithBun()
    // Fixed so the dev URL (and the session cookie's login) survives restarts.
    .WithEndpoint("http", e => e.Port = 5173)
    .WithEnvironment("API_URL", api.GetEndpoint("http"))
    .WithReference(api)
    .WaitFor(api);

builder.Build().Run();
