# Kuitit

Self-hosted warranty receipts: store a photo or PDF of a receipt with its purchase date and warranty length.
Runs as a single container on a Synology NAS, signs in with OIDC (Synology SSO Server), and keeps everything
that would change for a cloud move (DB, files, IdP) behind configuration.

- API: .NET 10 minimal APIs, EF Core + SQLite, OIDC + cookie (BFF; tokens never reach the browser)
- SPA: React 19, TanStack Router/Query/Form/Table, Tailwind v4, i18next (en, fi), dark mode
- Local dev: Aspire AppHost + `mock-oauth2-server`

## Layout

| Path | What |
|---|---|
| `src/Kuitit.Api` | API + serves the built SPA from `wwwroot` |
| `src/Kuitit.AppHost` | Aspire orchestration for local dev |
| `tools/Kuitit.DevSeed` | Sample receipts for user `dev`, run by the AppHost |
| `tests/Kuitit.Api.Tests` | xUnit v3 integration tests (`WebApplicationFactory`, header auth, temp SQLite) |
| `web/` | Vite app; `web/openapi.json` is written by the API build, the TS client is generated from it |

## Development

Prerequisites: .NET SDK 10, Bun 1.4, Docker.

```sh
dotnet tool restore
dotnet run --project src/Kuitit.AppHost
```

Open http://localhost:5173 (the `web` resource). The mock IdP login accepts any username (it becomes `sub`);
enter `{"email": "you@example.com"}` in its claims box to set an email. Use two usernames to check that users
can't see each other's receipts. Data goes to `./.data` (gitignored).

Sign in as `dev` to get sample receipts (expired, expiring soon, valid, archived). The `seed` resource adds them
when `dev` has none, so delete `./.data` to start over.

Common commands:

```sh
dotnet test                       # API tests
dotnet csharpier format .         # C# formatting (120 columns)
dotnet ef migrations add <Name> -p src/Kuitit.Api -o Data/Migrations

cd web
bun run check-all                 # oxlint, prettier, tsc, vitest
bun run client                    # regenerate the API client after an API change (after dotnet build)
```

API changes: `dotnet build` rewrites `web/openapi.json`; then `bun run client`. CI fails if either is stale.

TypeScript: type checking uses TS 7 (`typescript7` alias). TS 6 (`typescript`) stays only because
`@hey-api/openapi-ts` needs the compiler JS API that TS 7 does not ship yet; drop it once hey-api supports TS 7.

## Configuration

| Setting | Meaning |
|---|---|
| `DATA_DIR` | SQLite DB (`app.db`), uploads (`files/`), DataProtection keys (`keys/`). `/data` in the image. |
| `Auth__Authority` | OIDC issuer URL |
| `Auth__ClientId` / `Auth__ClientSecret` | OIDC client |
| `Auth__AllowedUsers__N` | Emails or subjects allowed to sign in. Empty denies everyone. |
| `ConnectionStrings__App` | Optional DB connection string override |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Optional. Exports traces, metrics and logs over OTLP (set automatically by Aspire in dev). |

## Deployment (Synology DSM 7)

1. **SSO Server** package: General Settings: set the server URL (HTTPS). Service: enable OIDC.
   Application List: add an app with redirect URI `https://<host>/signin-oidc` and post-logout redirect URI
   `https://<host>/signout-callback-oidc`. Note the client id, secret and well-known URL.
2. **Storage**: create a shared folder (e.g. `kuitit`) and a DSM service user with RW only there. Get its
   UID/GID over SSH with `id <user>`.
3. **Reverse proxy**: Control Panel > Login Portal > Advanced > Reverse Proxy: HTTPS `<host>:443` to HTTP
   `localhost:8080`. Under Custom Header add WebSocket/`X-Forwarded-*` headers. Use a Let's Encrypt cert.
   Uploads are up to 20 MB; raise the proxy body size if uploads fail with 413.
4. **Container Manager** > Project > Create: use `compose.yaml` from this repo and a `.env` based on
   `.env.example`. Log in to GHCR once if the image is private:
   `docker login ghcr.io -u <github user>` with a PAT that has `read:packages`.
5. Update: bump `KUITIT_VERSION` in `.env`, then `docker compose pull && docker compose up -d`. Migrations run at
   startup, so take a backup first.

Logs: `docker compose logs -f kuitit` over SSH. Rotated at 3 x 10 MB (`x-logging` in `compose.yaml`).

Telemetry dashboard (optional): set `OTEL_EXPORTER_OTLP_ENDPOINT` and `DASHBOARD_TOKEN` in `.env`, run
`docker compose --profile dashboard up -d`, and add a reverse proxy rule for `localhost:18888` (enable WebSocket
headers). Data is in memory only.

"OIDC callback failed" behind the proxy is almost always the external URL or `X-Forwarded-Proto` not matching
the redirect URI registered in SSO Server.

### Backups

Nightly Task Scheduler job, then Hyper Backup of the shared folder:

```sh
sqlite3 /volume1/kuitit/app.db ".backup '/volume1/kuitit/backup/app.db'"
```

(or a Btrfs snapshot of the shared folder).

## Releasing

```sh
git tag v0.1.0 && git push origin v0.1.0
```

The Release workflow builds `ghcr.io/jvalkeejarvi/kuitit:0.1.0` (+ `latest`) for `linux/amd64` and
`linux/arm64` and keeps the last 3 releases (GHCR free tier: 500 MB for private packages).

There is no Dockerfile: the .NET SDK builds the image (settings in `src/Kuitit.Api/Kuitit.Api.csproj`) and runs
`bun run build` first to put the SPA in `wwwroot`. Build one locally into Docker with:

```sh
dotnet publish src/Kuitit.Api -c Release -t:PublishContainer --os linux --arch arm64   # or x64
```
