# End-to-end smoke test for a running comGpt stack.
# Usage: .\scripts\smoke-test.ps1 [-Api http://localhost:8080] [-Email owner@omniflow.local] [-Password 'OmniFlow123!']
param(
    [string]$Api = "http://localhost:8080",
    [string]$Email = "owner@omniflow.local",
    [string]$Password = "OmniFlow123!"
)

$ErrorActionPreference = "Stop"
$script:Failures = 0

function Step($Name, [scriptblock]$Action) {
    Write-Host "`n==> $Name" -ForegroundColor Cyan
    try {
        & $Action
        Write-Host "    OK" -ForegroundColor Green
    } catch {
        $script:Failures++
        Write-Host "    FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

$session = $null
$organizationId = $null
$contactId = $null
$campaignId = $null

Step "Health" {
    $health = Invoke-RestMethod -Uri "$Api/actuator/health" -TimeoutSec 10
    if ($health.status -ne "UP") { throw "Health returned $($health.status)" }
}

Step "Login" {
    $auth = Invoke-RestMethod -Method Post -Uri "$Api/api/v1/auth/login" `
        -ContentType "application/json" `
        -Body (@{ email = $Email; password = $Password } | ConvertTo-Json)
    if (-not $auth.data.accessToken) { throw "No access token returned" }
    if (-not $auth.data.organizations -or $auth.data.organizations.Count -eq 0) { throw "No organizations on the account" }
    $script:session = $auth.data.accessToken
    $script:organizationId = $auth.data.organizations[0].id
    Write-Host "    workspace: $($auth.data.organizations[0].name)"
}

$headers = @{ Authorization = "Bearer $session"; "X-Organization-Id" = $organizationId }
$jsonHeaders = @{ Authorization = "Bearer $session"; "X-Organization-Id" = $organizationId; "Content-Type" = "application/json" }

Step "Me" {
    $me = Invoke-RestMethod -Uri "$Api/api/v1/auth/me" -Headers @{ Authorization = "Bearer $session" }
    if (-not $me.data.user.email) { throw "No user on /auth/me" }
}

Step "List contacts" {
    $contacts = Invoke-RestMethod -Uri "$Api/api/v1/contacts?page=0&size=5" -Headers $headers
    if ($null -eq $contacts.data.items) { throw "No items array" }
    $script:contactId = ($contacts.data.items | Select-Object -First 1).id
}

Step "Create contact" {
    $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $created = Invoke-RestMethod -Method Post -Uri "$Api/api/v1/contacts" -Headers $jsonHeaders `
        -Body (@{
            email     = "smoke+$stamp@example.com"
            firstName = "Smoke"
            lastName  = "Test"
            source    = "SMOKE_TEST"
        } | ConvertTo-Json)
    if (-not $created.data.id) { throw "Contact create returned no id" }
    $script:contactId = $created.data.id
}

Step "Analytics overview" {
    $overview = Invoke-RestMethod -Uri "$Api/api/v1/analytics/overview" -Headers $headers
    if ($null -eq $overview.data.contacts.total) { throw "Analytics shape unexpected" }
}

Step "List campaigns" {
    $campaigns = Invoke-RestMethod -Uri "$Api/api/v1/campaigns?page=0&size=5" -Headers $headers
    if ($null -eq $campaigns.data.items) { throw "No campaigns items array" }
    $script:campaignId = ($campaigns.data.items | Select-Object -First 1).id
}

Step "Create and launch draft campaign" {
    $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $segments = Invoke-RestMethod -Uri "$Api/api/v1/segments?page=0&size=1" -Headers $headers
    if (-not $segments.data.items -or $segments.data.items.Count -eq 0) { throw "No segment available for launch" }
    $campaign = Invoke-RestMethod -Method Post -Uri "$Api/api/v1/campaigns" -Headers $jsonHeaders `
        -Body (@{
            name        = "Smoke campaign $stamp"
            channel     = "EMAIL"
            subject     = "Smoke test"
            description = "Created by scripts/smoke-test.ps1"
            segmentId   = $segments.data.items[0].id
        } | ConvertTo-Json)
    if (-not $campaign.data.id) { throw "Campaign create returned no id" }
    $script:launchCampaignId = $campaign.data.id
    $launch = Invoke-RestMethod -Method Post -Uri "$Api/api/v1/campaigns/$($campaign.data.id)/launch" -Headers $jsonHeaders
    if (-not $launch.success) { throw "Launch did not succeed" }
}

Step "Worker materializes campaign audience" {
    $stats = $null
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Seconds 2
        $stats = Invoke-RestMethod -Uri "$Api/api/v1/campaigns/$script:launchCampaignId/stats" -Headers $headers
        if ($stats.data.totalRecipients -gt 0) { break }
    }
    if ($null -eq $stats -or $stats.data.totalRecipients -le 0) {
        throw "Worker did not materialize any campaign recipients (outbox/worker pipeline)"
    }
    $campaign = Invoke-RestMethod -Uri "$Api/api/v1/campaigns/$script:launchCampaignId" -Headers $headers
    if ($campaign.data.status -notin @("RUNNING", "COMPLETED", "PAUSED")) {
        throw "Campaign stayed in $($campaign.data.status) after launch"
    }
    Write-Host "    recipients: $($stats.data.totalRecipients) skipped: $($stats.data.skipped)"
}

Step "Billing plans" {
    $plans = Invoke-RestMethod -Uri "$Api/api/v1/billing/plans" -Headers $headers
    if (-not $plans.data -or $plans.data.Count -eq 0) { throw "No plans returned" }
}

Step "Webhook (SMS synthetic)" {
    $payload = @{
        id        = "smoke-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
        messageId = "smoke-message"
        status    = "delivered"
    } | ConvertTo-Json
    $response = Invoke-RestMethod -Method Post -Uri "$Api/api/v1/webhooks/sms/generic" `
        -ContentType "application/json" -Body $payload -TimeoutSec 15
    if (-not $response.success) { throw "Webhook did not acknowledge the event" }
}

Write-Host ""
if ($script:Failures -gt 0) {
    Write-Host "$($script:Failures) smoke step(s) failed." -ForegroundColor Red
    exit 1
}
Write-Host "All smoke steps passed." -ForegroundColor Green
