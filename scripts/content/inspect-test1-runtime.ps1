<#
Read-only Docker or host runtime inspection for TEST 1 target verification.
Use -Mode auto (default), docker, or host. Host mode requires Docker infra,
Node listeners and ready HTTP endpoints; env files are configuration evidence,
not proof of the running processes' effective environment.
Prints no credentials, does not exec in containers, restart, migrate or write data.
#>
[CmdletBinding()]
param(
    [string]$OutDir = '',
    [ValidateSet('auto', 'docker', 'host')][string]$Mode = 'auto'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
if ([string]::IsNullOrWhiteSpace($OutDir)) {
    $OutDir = Join-Path $repoRoot ('tmp/test1-runtime-inspection-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
}
if (-not [IO.Path]::IsPathRooted($OutDir)) { $OutDir = Join-Path $repoRoot $OutDir }
$resolvedOut = [IO.Path]::GetFullPath($OutDir)
$allowedRoot = (Join-Path $repoRoot 'tmp') + [IO.Path]::DirectorySeparatorChar
if (-not $resolvedOut.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Output must be a new directory under this repository tmp folder.'
}
if (Test-Path -LiteralPath $resolvedOut) { throw 'Output exists; choose a new -OutDir.' }

function Read-DockerOutput {
    param([string[]]$DockerArguments)
    $result = & docker @DockerArguments 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker read-only inspection failed. Run from a terminal authorized to access Docker. No container changes were performed.'
    }
    return ($result -join "`n")
}

function Get-SafeUri {
    param([string]$Value, [switch]$Database)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
    $uri = [Uri]$Value
    if (-not $uri.IsAbsoluteUri -or [string]::IsNullOrWhiteSpace($uri.Host)) {
        throw 'A selected runtime URL could not be parsed safely.'
    }
    $port = $uri.Port
    if ($Database -and $port -lt 0) { $port = 5432 }
    $safe = [ordered]@{ scheme = $uri.Scheme; host = $uri.Host; port = $port }
    if ($Database) { $safe.name = $uri.AbsolutePath.TrimStart('/') }
    else { $safe.path = $uri.AbsolutePath }
    return $safe
}

function Get-HostListenerEvidence {
    param([int]$Port)
    $owners = @()
    $source = 'Get-NetTCPConnection'
    try {
        $owners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop |
            Where-Object { $_.LocalAddress -in @('0.0.0.0', '127.0.0.1', '::', '::1') } |
            ForEach-Object { [int]$_.OwningProcess } | Sort-Object -Unique)
    } catch { $owners = @() }
    if ($owners.Count -eq 0) {
        $source = 'netstat'
        # Numeric output only; match the entire local port, never remote ports.
        $lines = @(& netstat -ano -p tcp 2>$null)
        if ($LASTEXITCODE -eq 0) {
            $owners = @($lines | ForEach-Object {
                $fields = $_.Trim() -split '\s+'
                if ($fields.Count -eq 5 -and $fields[0] -eq 'TCP' -and
                    $fields[1] -match ('^(?:0\.0\.0\.0|127\.0\.0\.1|\[::\]|\[::1\]):' + $Port + '$') -and
                    $fields[3] -eq 'LISTENING' -and $fields[4] -match '^\d+$') {
                    [int]$fields[4]
                }
            } | Sort-Object -Unique)
        }
    }
    if ($owners.Count -eq 0) {
        return [ordered]@{ verified = $false; port = $Port; reason = 'Listener PID unavailable; HTTP readiness succeeded but process identity is unverified.' }
    }
    if ($owners.Count -gt 1) {
        throw ('Multiple listener processes on port ' + $Port + ': ' + ($owners -join ', ') + '. Check port conflicts.')
    }
    try { $listenerProcess = Get-Process -Id $owners[0] -ErrorAction Stop }
    catch {
        return [ordered]@{ verified = $false; port = $Port; processId = $owners[0]; source = $source; reason = 'Listener process could not be inspected.' }
    }
    if ($listenerProcess.ProcessName -ne 'node') {
        throw ('Port ' + $Port + ' is owned by ' + $listenerProcess.ProcessName + ' (PID ' + $owners[0] + '), not Node. Check port conflicts or choose -Mode docker.')
    }
    return [ordered]@{ verified = $true; port = $Port; processId = $listenerProcess.Id; processName = $listenerProcess.ProcessName; source = $source }
}

Push-Location -LiteralPath $repoRoot
try {
    if ($Mode -eq 'auto') {
        $gatewayIds = Read-DockerOutput -DockerArguments @('compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.apps.yml', 'ps', '-q', 'api-gateway')
        if ([string]::IsNullOrWhiteSpace($gatewayIds)) { $Mode = 'host' } else { $Mode = 'docker' }
    }
    $hostServices = @()
    if ($Mode -eq 'host') {
        $hostJson = & node (Join-Path $PSScriptRoot 'inspect-test1-host.cjs')
        if ($LASTEXITCODE -ne 0) { throw 'Host configuration/readiness inspection failed; no evidence saved.' }
        $hostServices = @((($hostJson -join "`n") | ConvertFrom-Json))
        foreach ($hostService in $hostServices) {
            $listenerEvidence = Get-HostListenerEvidence -Port $hostService.port
            if (-not $listenerEvidence.verified) {
                Write-Warning ($hostService.service + ': ' + $listenerEvidence.reason)
            }
            $hostService | Add-Member -NotePropertyName listener -NotePropertyValue $listenerEvidence
        }
    }
    $proofContainers = @()
    $containerServices = @('postgres', 'minio')
    if ($Mode -eq 'docker') { $containerServices = @('api-gateway', 'auth-service', 'question-bank-service', 'exam-service', 'learning-service', 'analytics-service', 'postgres', 'minio') }
    foreach ($service in $containerServices) {
        $idsText = Read-DockerOutput -DockerArguments @('compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.apps.yml', 'ps', '-q', $service)
        $ids = @($idsText -split '\r?\n' | Where-Object { $_.Trim() })
        if ($ids.Count -ne 1 -or $ids[0] -notmatch '^[a-f0-9]{12,64}$') {
            throw ('Expected exactly one existing running container for ' + $service)
        }
        # Raw inspect data stays in memory; only explicit safe fields are emitted.
        $inspectText = Read-DockerOutput -DockerArguments @('inspect', $ids[0])
        $items = @($inspectText | ConvertFrom-Json)
        if ($items.Count -ne 1) { throw 'Unexpected Docker inspect response.' }
        $container = $items[0]
        if ($container.Config.Labels.'com.docker.compose.service' -ne $service -or -not $container.State.Running) {
            throw ('Container identity/running state mismatch: ' + $service)
        }
        $runtimeEnv = @{}
        foreach ($entry in $container.Config.Env) {
            $pair = $entry -split '=', 2
            if ($pair.Count -eq 2) { $runtimeEnv[$pair[0]] = $pair[1] }
        }
        $urls = [ordered]@{}
        foreach ($key in @('MEDIA_PUBLIC_BASE_URL', 'MINIO_PUBLIC_ENDPOINT', 'QUESTION_BANK_SERVICE_URL', 'EXAM_SERVICE_URL', 'LEARNING_SERVICE_URL', 'AUTH_SERVICE_URL')) {
            if ($runtimeEnv.ContainsKey($key)) { $urls[$key] = Get-SafeUri -Value $runtimeEnv[$key] }
        }
        foreach ($key in @('MINIO_ENDPOINT', 'QUESTION_BANK_GRPC_URL')) {
            if ($runtimeEnv.ContainsKey($key)) {
                $value = $runtimeEnv[$key]
                if ($value -notmatch '^https?://') { $value = 'http://' + $value }
                $urls[$key] = Get-SafeUri -Value $value
            }
        }
        $settings = [ordered]@{}
        foreach ($key in @('MINIO_BUCKET', 'MINIO_REGION', 'MINIO_PUBLIC_READ', 'POSTGRES_DB')) {
            if ($runtimeEnv.ContainsKey($key)) { $settings[$key] = $runtimeEnv[$key] }
        }
        $networks = @($container.NetworkSettings.Networks.PSObject.Properties | ForEach-Object {
            [ordered]@{ name = $_.Name; networkId = $_.Value.NetworkID; ipAddress = $_.Value.IPAddress; aliases = @($_.Value.Aliases) }
        })
        $ports = @($container.NetworkSettings.Ports.PSObject.Properties | ForEach-Object {
            $key = $_.Name
            foreach ($binding in @($_.Value)) {
                if ($null -ne $binding) { [ordered]@{ containerPort = $key; hostIp = $binding.HostIp; hostPort = $binding.HostPort } }
            }
        })
        $workspaceMount = @($container.Mounts | Where-Object { $_.Destination -in @('/workspace', '/app') } | ForEach-Object {
            [ordered]@{ type = $_.Type; source = $_.Source; destination = $_.Destination }
        })
        $database = $null
        if ($runtimeEnv.ContainsKey('DATABASE_URL')) { $database = Get-SafeUri -Value $runtimeEnv['DATABASE_URL'] -Database }
        $proofContainers += [ordered]@{
            service = $service; id = $container.Id; name = $container.Name
            project = $container.Config.Labels.'com.docker.compose.project'
            running = $container.State.Running; startedAt = $container.State.StartedAt
            workingDirectory = $container.Config.WorkingDir; database = $database
            urls = $urls; settings = $settings; networks = $networks; publishedPorts = $ports
            workspaceMounts = $workspaceMount
        }
        Remove-Variable runtimeEnv, inspectText, items, container -ErrorAction SilentlyContinue
    }
    $projects = @($proofContainers | ForEach-Object { $_.project } | Sort-Object -Unique)
    if ($projects.Count -ne 1 -or [string]::IsNullOrWhiteSpace($projects[0])) { throw 'Containers do not share one verified Compose project.' }
    $hashes = @()
    foreach ($relative in @('docker-compose.yml', 'docker-compose.apps.yml', '.env', 'services/api-gateway/.env', 'services/auth-service/.env', 'services/question-bank-service/.env', 'services/exam-service/.env', 'services/learning-service/.env', 'services/analytics-service/.env')) {
        $file = Join-Path $repoRoot $relative
        if (Test-Path -LiteralPath $file) { $hashes += [ordered]@{ path = $relative; sha256 = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() } }
    }
    $proof = [ordered]@{
        schemaVersion = 2; evidenceType = 'READ_ONLY_RUNTIME_INSPECTION'; mode = $Mode
        capturedAt = [DateTime]::UtcNow.ToString('o'); repository = $repoRoot
        project = $projects[0]; containers = $proofContainers; hostServices = $hostServices; sourceHashes = $hashes
        credentialsIncluded = $false; dataWrites = $false; restartPerformed = $false
        note = 'This is sanitized runtime evidence, not an importer target manifest. Review with API/database/media probes before granting a scope.'
    }
    New-Item -ItemType Directory -Path $resolvedOut | Out-Null
    $proofFile = Join-Path $resolvedOut 'runtime-inspection.json'
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($proofFile, ($proof | ConvertTo-Json -Depth 12), $utf8)
    Write-Output ('Saved sanitized runtime inspection: ' + $proofFile)
    Write-Output 'Read-only: no restart, migration, seed, upload or database write. No credentials saved.'
}
finally { Pop-Location }
