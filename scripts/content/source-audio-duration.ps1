param([Parameter(Mandatory=$true)][string]$SourceDirectory)
$shell = New-Object -ComObject Shell.Application
$folder = $shell.NameSpace((Resolve-Path -LiteralPath $SourceDirectory).Path)
$file = Get-ChildItem -LiteralPath $SourceDirectory -File -Filter '1.3.*.mp3' | Select-Object -First 1
$item = $folder.ParseName($file.Name)
[pscustomobject]@{ file=$file.Name; duration100Nanoseconds=$item.ExtendedProperty('System.Media.Duration'); durationDisplay=$folder.GetDetailsOf($item,27); bitrate=$item.ExtendedProperty('System.Audio.EncodingBitrate') } | ConvertTo-Json
