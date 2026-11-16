# Start the comGpt data plane (database, cache, queue, mail catcher).
param(
    [switch]$All
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

if ($All) {
    docker compose up -d --build
} else {
    docker compose up -d postgres redis rabbitmq mailpit
}

Write-Host ""
Write-Host "comGpt infrastructure" -ForegroundColor Cyan
Write-Host "  PostgreSQL   localhost:5432  (db/user: omniflow)"
Write-Host "  Redis        localhost:6379"
Write-Host "  RabbitMQ     http://localhost:15672  (omniflow / omniflow_dev_password)"
Write-Host "  Mailpit      http://localhost:8025"
if ($All) {
    Write-Host "  API          http://localhost:8080"
    Write-Host "  Swagger      http://localhost:8080/swagger-ui.html"
    Write-Host "  Frontend     http://localhost:3000"
}
Write-Host ""
Write-Host "Run the backend inside Docker with: .\scripts\backend-build.ps1" -ForegroundColor DarkGray
