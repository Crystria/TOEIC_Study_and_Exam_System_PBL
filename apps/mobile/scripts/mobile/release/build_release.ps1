[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://')]
    [string]$ApiBaseUrl,

    [ValidateSet('apk', 'appbundle')]
    [string]$Format = 'apk'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$PubspecPath = Join-Path $ProjectRoot 'pubspec.yaml'
$Validator = Join-Path $PSScriptRoot 'validate_release_artifact.py'
$InputValidator = Join-Path $PSScriptRoot 'validate_release_inputs.py'
$ArchitectureValidator = Join-Path $ProjectRoot 'scripts\mobile\architecture\validate_feature_boundaries.py'
$Python = Get-Command python -ErrorAction SilentlyContinue
$Flutter = Get-Command flutter -ErrorAction SilentlyContinue

if (-not $Python) { throw 'Python is required to validate the Release source graph and APK/AAB artifact.' }
if (-not $Flutter) { throw 'Flutter CLI was not found in PATH.' }
if (-not (Test-Path $PubspecPath)) { throw "pubspec.yaml not found: $PubspecPath" }

& $Python.Source $ArchitectureValidator --project-root $ProjectRoot
if ($LASTEXITCODE -ne 0) { throw 'Feature dependency boundary validation failed.' }

& $Python.Source $InputValidator --project-root $ProjectRoot
if ($LASTEXITCODE -ne 0) { throw 'Release source isolation validation failed.' }

$OriginalPubspec = [System.IO.File]::ReadAllText($PubspecPath)
$ExpectedAssets = @(
    'test_data/learning/vocabulary_catalog_current_source.json',
    'test_data/learning/grammar_catalog_current_source.json',
    'test_data/exam/test_catalog.json',
    'test_data/exam/part_structure.json',
    'test_data/ai_chat/conversations_and_messages_current_source.json'
)
$FoundAssets = [regex]::Matches($OriginalPubspec, '(?m)^\s*-\s+(test_data/[^\r\n]+)') | ForEach-Object { $_.Groups[1].Value.Trim() }
$ActualAssetsSorted = @($FoundAssets | Sort-Object -Unique) -join "`n"
$ExpectedAssetsSorted = @($ExpectedAssets | Sort-Object -Unique) -join "`n"
if ($ActualAssetsSorted -ne $ExpectedAssetsSorted) {
    throw 'The Flutter Test Data asset list differs from the reviewed allow-list. Update and review the Release filter before building.'
}

# Remove only the reviewed Development Test Data entries. Keep any legitimate
# runtime assets that may be added to the same Flutter assets block later.
$PubspecLines = $OriginalPubspec -split "`r?`n"
$ReleaseLines = [System.Collections.Generic.List[string]]::new()
for ($Index = 0; $Index -lt $PubspecLines.Length; $Index++) {
    $Line = $PubspecLines[$Index]
    if ($Line -match '^  assets:\s*$') {
        $BlockLines = [System.Collections.Generic.List[string]]::new()
        $Next = $Index + 1
        while ($Next -lt $PubspecLines.Length) {
            $Candidate = $PubspecLines[$Next]
            if ($Candidate -eq '' -or $Candidate -match '^    ') {
                $BlockLines.Add($Candidate)
                $Next++
                continue
            }
            break
        }

        $RemainingAssetLines = @(
            $BlockLines | Where-Object {
                $_ -notmatch '^\s*-\s+test_data/'
            }
        )
        $RemainingAssetEntries = @(
            $RemainingAssetLines | Where-Object { $_ -match '^\s*-\s+' }
        )
        $HasRemainingAsset = $RemainingAssetEntries.Count -gt 0

        if ($HasRemainingAsset) {
            $ReleaseLines.Add($Line)
            foreach ($RemainingLine in $RemainingAssetLines) {
                $ReleaseLines.Add($RemainingLine)
            }
        }
        $Index = $Next - 1
        continue
    }
    $ReleaseLines.Add($Line)
}
$ReleasePubspec = [string]::Join("`n", $ReleaseLines)
if ($ReleasePubspec -match '(?m)^\s*-\s+test_data/') {
    throw 'Test Data assets remain in the temporary Release pubspec.'
}

$ArtifactPath = if ($Format -eq 'apk') {
    Join-Path $ProjectRoot 'build\app\outputs\flutter-apk\app-release.apk'
} else {
    Join-Path $ProjectRoot 'build\app\outputs\bundle\release\app-release.aab'
}

try {
    [System.IO.File]::WriteAllText($PubspecPath, $ReleasePubspec, [System.Text.UTF8Encoding]::new($false))
    Push-Location $ProjectRoot
    try {
        & $Flutter.Source pub get --enforce-lockfile
        if ($LASTEXITCODE -ne 0) { throw 'flutter pub get --enforce-lockfile failed.' }

        $BuildArgs = @(
            'build', $Format, '--release', '--target', 'lib/main_release.dart',
            "--dart-define=APP_ENV=production",
            "--dart-define=API_BASE_URL=$ApiBaseUrl",
            '--dart-define=API_ENABLED=false',
            '--dart-define=API_AUTH_ENABLED=true',
            '--dart-define=API_LEARNING_ENABLED=true',
            '--dart-define=API_MOCK_TEST_ENABLED=true',
            '--dart-define=API_ANALYTICS_ENABLED=true'
        )
        & $Flutter.Source @BuildArgs
        if ($LASTEXITCODE -ne 0) { throw "flutter build $Format --release failed." }
    }
    finally {
        Pop-Location
    }

    & $Python.Source $Validator $ArtifactPath
    if ($LASTEXITCODE -ne 0) { throw 'Compiled Release artifact failed Test Data isolation validation.' }

    Write-Host "Release build validated: $ArtifactPath" -ForegroundColor Green
}
finally {
    # Restore the Development pubspec even when pub get/build/validation fails.
    [System.IO.File]::WriteAllText($PubspecPath, $OriginalPubspec, [System.Text.UTF8Encoding]::new($false))
}
