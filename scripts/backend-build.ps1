# Build the Spring Boot backend inside Docker (no host JDK required).
# Usage:
#   .\scripts\backend-build.ps1                      # package (skip tests)
#   .\scripts\backend-build.ps1 verify               # run full verify
#   .\scripts\backend-build.ps1 -DskipTests package
#
# The repository root is mounted (not just ./backend) because the app and worker
# modules package Flyway SQL from ../database/migrations into db/migration.
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$MavenArgs
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$m2Path = Join-Path $HOME ".m2"
if (-not (Test-Path $m2Path)) { New-Item -ItemType Directory -Path $m2Path | Out-Null }

if (-not $MavenArgs -or $MavenArgs.Count -eq 0) {
    $MavenArgs = @("-DskipTests", "package")
}

Write-Host "Building backend in Docker..." -ForegroundColor Cyan
docker run --rm `
    -v "${repoRoot}:/workspace" `
    -v "${m2Path}:/root/.m2" `
    -w /workspace `
    maven:3.9-eclipse-temurin-21 `
    mvn -B -ntp -f backend/pom.xml @MavenArgs

if ($LASTEXITCODE -ne 0) { throw "Backend build failed with exit code $LASTEXITCODE" }
Write-Host "Backend build finished." -ForegroundColor Green
