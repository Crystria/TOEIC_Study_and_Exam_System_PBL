param(
    [Parameter(Mandatory = $true)][string]$Content,
    [Parameter(Mandatory = $true)][string]$OutputDirectory,
    [string]$Voice = 'Microsoft David Desktop',
    [string]$SecondVoice = 'Microsoft Zira Desktop',
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $enabled = @($synth.GetInstalledVoices() | Where-Object Enabled | ForEach-Object { $_.VoiceInfo.Name })
    Write-Output ('Enabled voices: ' + ($enabled -join ', '))
    foreach ($name in @($Voice, $SecondVoice)) {
        if ($enabled -notcontains $name) { throw "Required voice unavailable: $name" }
    }
    if ($CheckOnly) { return }
    if (-not (Test-Path -LiteralPath $OutputDirectory -PathType Container)) {
        throw 'OutputDirectory must already exist.'
    }
    $data = Get-Content -LiteralPath $Content -Raw -Encoding UTF8 | ConvertFrom-Json
    @{
        WindowsVersion = [Environment]::OSVersion.VersionString
        Assembly = [System.Speech.Synthesis.SpeechSynthesizer].Assembly.FullName
        Voices = @($synth.GetInstalledVoices() | Where-Object Enabled | ForEach-Object {
            @{ Name = $_.VoiceInfo.Name; Id = $_.VoiceInfo.Id; Culture = $_.VoiceInfo.Culture.Name;
               Gender = [string]$_.VoiceInfo.Gender; AdditionalInfo = $_.VoiceInfo.AdditionalInfo }
        })
    } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'voice-info.json') -Encoding UTF8
    $synth.Rate = -1
    $synth.Volume = 100
    foreach ($clip in $data.clips) {
        if ($clip.id -notmatch '^[a-z0-9-]+$') { throw 'Invalid clip ID' }
        $target = Join-Path $OutputDirectory ($clip.id + '.wav')
        if (Test-Path -LiteralPath $target) { throw "Refusing to overwrite $target" }
        $prompt = New-Object System.Speech.Synthesis.PromptBuilder
        foreach ($segment in $clip.segments) {
            $selected = if ($segment.speaker -eq 'second') { $SecondVoice } else { $Voice }
            $prompt.StartVoice($selected)
            $prompt.AppendText([string]$segment.text)
            $prompt.EndVoice()
            $prompt.AppendBreak([TimeSpan]::FromMilliseconds(550))
        }
        try {
            $synth.SetOutputToWaveFile($target)
            $synth.Speak($prompt)
        } finally {
            $synth.SetOutputToNull()
        }
        if ((Get-Item -LiteralPath $target).Length -le 44) { throw "Empty WAV: $target" }
        Write-Output ('Synthesized ' + $clip.id)
    }
} finally {
    $synth.Dispose()
}
