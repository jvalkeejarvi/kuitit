# syntax=docker/dockerfile:1

# --- SPA ---
FROM --platform=$BUILDPLATFORM oven/bun:1.4.4 AS web
WORKDIR /src/web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY web/ ./
RUN bun run build

# --- API (ReadyToRun, cross-compiled for the target platform) ---
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS api
ARG TARGETARCH
ARG VERSION=0.0.0
WORKDIR /src
COPY global.json Directory.Build.props Directory.Packages.props .editorconfig ./
COPY src/Kuitit.Api/Kuitit.Api.csproj src/Kuitit.Api/
RUN dotnet restore src/Kuitit.Api -a $TARGETARCH -p:PublishReadyToRun=true
COPY src/Kuitit.Api/ src/Kuitit.Api/
RUN dotnet publish src/Kuitit.Api -c Release -a $TARGETARCH --no-restore -o /app \
    -p:PublishReadyToRun=true \
    -p:OpenApiGenerateDocuments=false \
    -p:Version=$VERSION
COPY --from=web /src/web/dist /app/wwwroot

# --- Runtime: chiseled (no shell, no package manager), non-root ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled
WORKDIR /app
COPY --from=api /app ./
ENV ASPNETCORE_HTTP_PORTS=8080 \
    DATA_DIR=/data \
    DOTNET_gcServer=0 \
    DOTNET_GCConserveMemory=5 \
    DOTNET_TieredPGO=0
EXPOSE 8080
VOLUME /data
ENTRYPOINT ["dotnet", "Kuitit.Api.dll"]
