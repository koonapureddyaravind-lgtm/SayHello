# Create a consistent PostgreSQL backup of the running comGpt stack.
# The dump is produced inside the postgres container (no host pg_dump required)
# and copied out as a binary custom-format archive.
#
# Usage:
#   .\scripts\backup-db.ps1
#   .\scripts\backup-db.ps1 -OutputDir D:\backups\omniflow -Keep 30

param(
    [string]$OutputDir = "backups",
    [int]$Keep = 14,
    [string]$Container = "omniflow-postgres",
    [string]$Database = $(if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "omniflow" }),
    [string]$User = $(if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "omniflow" })
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

$state = docker inspect --format "{{.State.Running}}" $Container 2>$null
if ($state -ne "true") {
    throw "Container '$Container' is not running. Start the stack with: docker compose up -d postgres"
}

$outPath = if ([System.IO.Path]::IsPathRooted($OutputDir)) { $OutputDir } else { Join-Path $root $OutputDir }
if (-not (Test-Path $outPath)) { New-Item -ItemType Directory -Path $outPath -Force | Out-Null }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$fileName = "omniflow-$stamp.dump"
$tmpPath = "/tmp/$fileName"
$localPath = Join-Path $outPath $fileName

Write-Host "Dumping database '$Database' as '$User'..." -ForegroundColor Cyan
docker exec $Container pg_dump -U $User -d $Database -Fc -f $tmpPath
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }

docker cp "${Container}:${tmpPath}" $localPath
if ($LASTEXITCODE -ne 0) { throw "docker cp failed with exit code $LASTEXITCODE" }

docker exec $Container rm -f $tmpPath | Out-Null

$sizeMb = [math]::Round((Get-Item $localPath).Length / 1MB, 2)
Write-Host "Backup written: $localPath ($sizeMb MB)" -ForegroundColor Green

if ($Keep -gt 0) {
    $old = Get-ChildItem -Path $outPath -Filter "omniflow-*.dump" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -Skip $Keep
    foreach ($file in $old) {
        Remove-Item $file.FullName -Force
        Write-Host "Removed old backup: $($file.Name)" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "Restore with: .\scripts\restore-db.ps1 -BackupFile `"$localPath`"" -ForegroundColor DarkGray
