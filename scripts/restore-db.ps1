# Restore a comGpt PostgreSQL backup into the running Docker stack.
# API/worker/frontend are stopped first so no writer can race the restore.
#
# Usage:
#   .\scripts\restore-db.ps1 -BackupFile .\backups\omniflow-20261108-120000.dump
#   .\scripts\restore-db.ps1 -BackupFile .\backups\omniflow-...dump -Force

param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [switch]$Force,
    [string]$Container = "omniflow-postgres",
    [string]$Database = $(if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "omniflow" }),
    [string]$User = $(if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "omniflow" })
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

if (-not (Test-Path $BackupFile)) { throw "Backup file not found: $BackupFile" }
$source = (Resolve-Path $BackupFile).Path

if (-not $Force) {
    Write-Host "This REPLACES all current data in database '$Database'." -ForegroundColor Yellow
    $answer = Read-Host "Type 'restore' to continue"
    if ($answer -ne "restore") { Write-Host "Aborted."; exit 0 }
}

$state = docker inspect --format "{{.State.Running}}" $Container 2>$null
if ($state -ne "true") {
    throw "Container '$Container' is not running. Start it with: docker compose up -d postgres"
}

Write-Host "Stopping application writers..." -ForegroundColor Cyan
docker compose stop backend-api backend-worker frontend | Out-Null

$tmpPath = "/tmp/omniflow-restore.dump"
try {
    docker cp $source "${Container}:${tmpPath}"
    if ($LASTEXITCODE -ne 0) { throw "docker cp failed with exit code $LASTEXITCODE" }

    Write-Host "Restoring '$source'..." -ForegroundColor Cyan
    docker exec $Container pg_restore -U $User -d $Database --clean --if-exists --no-owner --no-privileges $tmpPath
    $restoreExit = $LASTEXITCODE
    docker exec $Container rm -f $tmpPath | Out-Null

    # pg_restore exits 1 for benign "does not exist, skipping" notices on a first restore.
    if ($restoreExit -ne 0) {
        Write-Host "pg_restore reported issues (exit $restoreExit). Review the output above." -ForegroundColor Yellow
    } else {
        Write-Host "Restore completed." -ForegroundColor Green
    }
}
finally {
    Write-Host "Starting application containers..." -ForegroundColor Cyan
    docker compose up -d backend-api backend-worker frontend | Out-Null
}

Write-Host ""
Write-Host "Flyway will validate/repair the schema on API startup." -ForegroundColor DarkGray
Write-Host "Check health: docker compose ps" -ForegroundColor DarkGray
