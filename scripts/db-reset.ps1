# Drop volumes and recreate a clean local database, then start infrastructure.
param([switch]$Force)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

if (-not $Force) {
    $answer = Read-Host "This deletes all local comGpt data. Type 'yes' to continue"
    if ($answer -ne "yes") { Write-Host "Aborted."; exit 0 }
}

docker compose down -v
docker compose up -d postgres redis rabbitmq mailpit
Write-Host "Clean environment started. Flyway will migrate on next API start." -ForegroundColor Green
