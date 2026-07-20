param(
    [string]$CreatorPath = $env:COCOS_CREATOR_PATH
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$DocsPath = Join-Path $ProjectRoot 'docs'

if (-not $CreatorPath) {
    $Candidates = @(
        'J:\Cocos\cocos\Editor\Creator\3.8.7\CocosCreator.exe',
        'C:\ProgramData\cocos\editors\Creator\3.8.7\CocosCreator.exe',
        'C:\Program Files\CocosCreator\CocosCreator.exe'
    )

    $CreatorPath = $Candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

if (-not $CreatorPath -or -not (Test-Path -LiteralPath $CreatorPath)) {
    throw 'CocosCreator.exe was not found. Set COCOS_CREATOR_PATH or pass -CreatorPath.'
}

$DocsParent = Split-Path -Path $DocsPath -Parent
if ($DocsParent -ne $ProjectRoot) {
    throw "Refusing to clean unexpected docs path: $DocsPath"
}

if (Test-Path -LiteralPath $DocsPath) {
    Remove-Item -LiteralPath $DocsPath -Recurse -Force
}

$LogDir = Join-Path $ProjectRoot 'temp\logs'
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$LogPath = Join-Path $LogDir 'build-pages.log'

$BuildOptions = @(
    'platform=web-mobile',
    "buildPath=$ProjectRoot",
    'outputName=docs',
    'debug=false',
    'sourceMaps=false',
    'md5Cache=false',
    "logDest=$LogPath"
) -join ';'

$Arguments = @('--project', $ProjectRoot, '--build', $BuildOptions)
$Process = Start-Process -FilePath $CreatorPath -ArgumentList $Arguments -Wait -PassThru -WindowStyle Hidden
if ($Process.ExitCode -notin @(0, 36)) {
    throw "Cocos Creator build failed with exit code $($Process.ExitCode). See $LogPath."
}

$SettingsPath = Join-Path $DocsPath 'src\settings.json'
if (Test-Path -LiteralPath $SettingsPath) {
    $Settings = Get-Content -Raw -LiteralPath $SettingsPath | ConvertFrom-Json
    if (-not $Settings.screen) {
        $Settings | Add-Member -MemberType NoteProperty -Name screen -Value ([pscustomobject]@{})
    }

    $Settings.screen.exactFitScreen = $false
    $SettingsJson = $Settings | ConvertTo-Json -Depth 100 -Compress
    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($SettingsPath, $SettingsJson, $Utf8NoBom)
}

$NoJekyllPath = Join-Path $DocsPath '.nojekyll'
New-Item -ItemType File -Path $NoJekyllPath -Force | Out-Null
