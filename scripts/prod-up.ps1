# Bring up comGpt in production mode: Caddy auto-HTTPS + hardened compose override.
# Requires a filled-in .env (copy from .env.production.example first).
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if (-not (Test-Path ".env")) {
    Write-Error "Missing .env. Copy .env.production.example to .env and fill it in first."
    exit 1
}

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build @args
exit $LASTEXITCODE