$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$patchSource = Get-Content -LiteralPath (Join-Path $projectRoot 'patch.mjs') -Raw
if ($patchSource -notmatch "export const VERSION = '([0-9]+\.[0-9]+\.[0-9]+)';") {
    throw 'Cannot determine patch version.'
}
$patchVersion = $Matches[1]
$archiveName = "Antigravity-Chinese-Localization-v$patchVersion.zip"
$distributionRoot = Join-Path $projectRoot 'dist'
$stagingRoot = Join-Path $distributionRoot ('staging-' + [Guid]::NewGuid().ToString('N'))
$packageRoot = Join-Path $stagingRoot "Antigravity-Chinese-Localization-v$patchVersion"
$packageFiles = @(
    'asar.mjs', 'patch.mjs', 'localization.js', 'translations.txt',
    'install_chinese.bat', 'uninstall_chinese.bat', 'check_chinese.bat', 'start_chinese.bat',
    'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'docs/汉化说明.md'
)
# Refuse to reuse a staging directory: an old or unexpected file cannot enter the ZIP.
if (Test-Path -LiteralPath $packageRoot) {
    throw "Package staging folder already exists: $packageRoot"
}
foreach ($relativeFile in $packageFiles) {
    $sourceFile = Join-Path $projectRoot $relativeFile
    $targetFile = Join-Path $packageRoot $relativeFile
    if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) {
        throw "Missing package source: $relativeFile"
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $targetFile) -Force | Out-Null
    Copy-Item -LiteralPath $sourceFile -Destination $targetFile
}
$archivePath = Join-Path $distributionRoot $archiveName
Compress-Archive -LiteralPath $packageRoot -DestinationPath $archivePath -CompressionLevel Optimal -Force
$digest = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
$checksumPath = Join-Path $distributionRoot 'SHA256SUMS.txt'
[IO.File]::WriteAllText($checksumPath, "$digest  $archiveName`n", [Text.UTF8Encoding]::new($false))
Write-Output $archivePath
Write-Output "$digest  $archiveName"
