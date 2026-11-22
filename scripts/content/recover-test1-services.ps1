# Run from a user terminal that already has Docker access. No policy changes or data reset.
param(
  [ValidateRange(10, 600)]
  [int]$ReadinessTimeoutSeconds = 180
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
Push-Location -LiteralPath $projectRoot
try {
  $composeArgs = @('compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.apps.yml')
  $services = @('question-bank-service', 'exam-service')
  $containerIds = @{}
  foreach ($service in $services) {
    $ids = @(& docker @composeArgs ps --all --quiet $service)
    if ($LASTEXITCODE -ne 0) { throw "Cannot inspect $service; Docker access is required." }
    $ids = @($ids | Where-Object { $_ -match '^[a-f0-9]{12,64}$' })
    if ($ids.Count -ne 1) { throw "Expected exactly one existing container for $service; nothing restarted." }
    $containerId = $ids[0]
    $labelsJson = & docker inspect --format '{{json .Config.Labels}}' $containerId
    if ($LASTEXITCODE -ne 0) { throw "Cannot inspect container labels for $service." }
    $labels = $labelsJson | ConvertFrom-Json
    if ($labels.'com.docker.compose.service' -ne $service) { throw "Container identity mismatch for $service." }
    $containerIds[$service] = $containerId
    $source = Join-Path $projectRoot "services/$service/src/modules/outbox/outbox-relay.ts"
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing tested relay source for $service." }
  }

  foreach ($service in $services) {
    $source = Join-Path $projectRoot "services/$service/src/modules/outbox/outbox-relay.ts"
    $destination = $containerIds[$service] + ":/app/services/$service/src/modules/outbox/outbox-relay.ts"
    & docker cp $source $destination
    if ($LASTEXITCODE -ne 0) { throw "Failed to copy $service source; inspect logs before retrying." }
  }
  & docker @composeArgs restart question-bank-service exam-service
  if ($LASTEXITCODE -ne 0) { throw 'Restart failed; keep the existing database/volumes and inspect logs.' }
  Write-Output 'Only the two existing services were restarted. No migrate, seed, volume deletion or environment changes were performed.'
  Write-Output 'Waiting for compilation/startup and Gateway readiness...'
  $deadline = [DateTime]::UtcNow.AddSeconds($ReadinessTimeoutSeconds)
  $lastReadinessError = 'No readiness response received.'
  $ready = $false
  do {
    try {
      $readiness = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/ready' -TimeoutSec 5 -ErrorAction Stop
      if ($readiness.status -eq 'ready' -and $readiness.checks.questions -eq 'ok' -and $readiness.checks.exam -eq 'ok') {
        $ready = $true
        break
      }
      $lastReadinessError = $readiness | ConvertTo-Json -Depth 6 -Compress
    } catch {
      $lastReadinessError = $_.Exception.Message
      if ($_.ErrorDetails.Message) { $lastReadinessError += ' ' + $_.ErrorDetails.Message }
    }
    if ([DateTime]::UtcNow -lt $deadline) { Start-Sleep -Seconds 2 }
  } while ([DateTime]::UtcNow -lt $deadline)

  if (-not $ready) {
    & docker @composeArgs logs --no-color --tail 100 question-bank-service exam-service
    throw "Gateway did not become ready within $ReadinessTimeoutSeconds seconds. $lastReadinessError Keep the existing database/volumes; inspect the logs above before retrying."
  }
  Write-Output 'Gateway is ready; Question Bank and Exam report ok.'
  $readiness | ConvertTo-Json -Depth 6
} finally {
  Pop-Location
}
