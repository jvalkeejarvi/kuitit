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
| `Auth__AllowedUsers__N` | Emails or subjects allowed to sign in, or `*` for anyone the IdP signs in. Empty denies everyone. |
| `ConnectionStrings__App` | Optional DB connection string override |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Optional. Exports traces, metrics and logs over OTLP (set automatically by Aspire in dev). |

### Testing the production image locally

Builds the image for your machine and runs it with the mock IdP (any username signs in, `*` allowlist):

```sh
dotnet publish src/Kuitit.Api -c Release -t:PublishContainer --os linux --arch arm64 -p:ContainerImageTag=local
docker compose -f compose.local.yaml up          # http://localhost:8080
```

Use `--arch x64` on Intel. Data goes to `./.data/local-image`. Stop Aspire first; both use port 8090 for the IdP.

Sample receipts for user `dev` (then restart the container: SQLite can't share its WAL across the Docker VM):

```sh
DATA_DIR=.data/local-image Auth__Authority=http://localhost:8090/default dotnet run --project tools/Kuitit.DevSeed
docker compose -f compose.local.yaml restart kuitit
```

## Deployment (Synology DSM 7)

Replace `kuitit.example.com` and `sso.example.com` with your host names. Takes about 15 minutes.

### Install

1. **Package Center**: install **Container Manager** and **SSO Server**.
2. **App user** (Control Panel > User): create a dedicated DSM user for the app (no admin rights, no other
   folder access). Get its UID and GID over SSH: `id <user>`.
3. **Data folder** (Control Panel > Shared Folder > Create): name `kuitit`. Permissions: read/write for the app
   user, administrators only otherwise. Inside it create `data` (File Station) and hand it to the app
   user over SSH: `sudo chown -R <uid>:<gid> /volume1/kuitit/data`. Receipts and the database live here,
   unencrypted at rest; DSM permissions keep other users out. (DSM can only encrypt a volume when it is
   created, so encrypting an existing one means rebuilding it. With an encrypted volume whose key you unlock by
   hand after boot, restart the `kuitit` project after unlocking so the container doesn't start on an empty
   path.)
4. **Project folder** (File Station): in the `docker` shared folder (created by Container Manager) create
   `kuitit`. It holds only `compose.yaml` and `.env`.
5. **Certificate** (Control Panel > Security > Certificate): add a Let's Encrypt certificate for
   `kuitit.example.com`, or use an existing wildcard one.
6. **Reverse proxy** (Control Panel > Login Portal > Advanced > Reverse Proxy > Create):
   - Source: HTTPS, `kuitit.example.com`, port 443. Destination: HTTP, `localhost`, port 8080.
   - Custom Header: Create > WebSocket, then add `X-Forwarded-Proto` = `$scheme`.
   - Back in Certificate > Settings, assign the certificate to this proxy entry.
   - Uploads are up to 20 MB; if they fail with 413, raise the proxy body size.
7. **SSO Server** (its login page is DSM's, so give it its own portal instead of exposing DSM):
   - Control Panel > Login Portal > Applications > SSO Server > Edit: customized domain `sso.example.com`,
     port fields empty (served on 443 like other portals). Assign the certificate to it.
   - SSO Server > General Settings: server URL exactly `https://sso.example.com`. SSO Server only answers on
     this URL ("unknown endpoint" elsewhere), and on another host DSM may send logins to its own port 5001.
   - Service: enable OIDC. Check `https://sso.example.com/webman/sso/.well-known/openid-configuration`
     returns JSON; its `issuer` is the authority for `.env`.
   - Application List > Add: redirect URI `https://kuitit.example.com/signin-oidc`, post-logout redirect URI
     `https://kuitit.example.com/signout-callback-oidc`. Copy the client ID and client secret.
   - The portal makes DSM's login (and its web API) reachable like any app portal: enforce 2FA for
     administrators and turn on Auto Block. Sign in to Kuitit with a non-admin account.
8. **Files**: from the latest GitHub release download `compose.yaml` and `env.example`. Save `env.example` as
   `.env`, fill in the required values (authority = well-known URL without `/.well-known/openid-configuration`,
   client ID and secret, UID and GID from step 2) and upload both files to `docker/kuitit`.
9. **Container Manager** > Project > Create: name `kuitit`, path `docker/kuitit`, use the existing compose
   file, no web portal. It pulls the image and starts the container.
10. Open `https://kuitit.example.com` and sign in with your DSM account.

### Update

1. Back up (see below); migrations run when the new version starts.
2. Replace `docker/kuitit/compose.yaml` with the one from the new release (or set `KUITIT_VERSION` in `.env`).
3. Container Manager > Project > `kuitit` > Action > Build. Over SSH instead, in `/volume1/docker/kuitit`:
   `docker compose pull && docker compose up -d`.

Logs: `docker compose logs -f kuitit` over SSH. Rotated at 3 x 10 MB (`x-logging` in `compose.yaml`).

Telemetry dashboard (optional): set `OTEL_EXPORTER_OTLP_ENDPOINT` and `DASHBOARD_TOKEN` in `.env`, run
`docker compose --profile dashboard up -d`, and add a reverse proxy rule for `localhost:18888` (enable WebSocket
headers). Data is in memory only.

Users: with `ALLOWED_USER_1=*` every DSM account can sign in, so inviting someone means creating them a DSM user
(Control Panel > User). Keep the Guest account disabled. To restrict, list emails or subjects in
`ALLOWED_USER_N` instead and restart. Receipts are always private to their owner.

Troubleshooting: "OIDC callback failed" behind the proxy is almost always the external URL or `X-Forwarded-Proto` not matching
the redirect URI registered in SSO Server.

### Backups

Hyper Backup of the whole `kuitit` shared folder (no file filter) plus `docker/kuitit` (`.env` holds the client
secret). Turn on backup encryption for destinations off the NAS and keep several versions (Smart Recycle).

The database is copied while live. A copy taken during a write can be inconsistent; writes are rare (adding,
archiving, deleting), so this is unlikely, and the previous version is the fallback. Receipt files are plain
files and always copy intact; what a bad database copy would lose is their names, dates and owners.

Restore: stop the `kuitit` project, restore `data/` (including `app.db` and `app.db-wal`), delete
`data/app.db-shm`, then start the project. If the database doesn't open, restore the previous version.

Optional, for a guaranteed-consistent database copy: a nightly Task Scheduler job (user `root`) before the
Hyper Backup run, and restore `backup/app.db` as `data/app.db` (deleting `app.db-wal` and `app.db-shm`):

```sh
mkdir -p /volume1/kuitit/backup
sqlite3 /volume1/kuitit/data/app.db ".backup '/volume1/kuitit/backup/app.db'"
```

## Releasing

```sh
git tag v0.1.0 && git push origin v0.1.0
```

The Release workflow builds `ghcr.io/jvalkeejarvi/kuitit:0.1.0` (+ `latest`) for `linux/amd64`, keeps the last
3 releases, and creates a GitHub release with `compose.yaml` (image pinned to that version) and `env.example`
attached for the NAS.

After the first release, make the image public once: GitHub > Packages > `kuitit` > Package settings > Change
visibility > Public. It contains no secrets (configuration comes from `.env`), and the NAS can then pull it
without a GitHub token. Public packages also don't count toward the GHCR storage quota.

There is no Dockerfile: the .NET SDK builds the image (settings in `src/Kuitit.Api/Kuitit.Api.csproj`) and runs
`bun run build` first to put the SPA in `wwwroot`. Build one locally into Docker with:

```sh
dotnet publish src/Kuitit.Api -c Release -t:PublishContainer 
```
