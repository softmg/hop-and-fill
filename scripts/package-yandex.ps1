$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = Split-Path -Parent $PSScriptRoot
$buildDir = (Resolve-Path (Join-Path $projectRoot "dist-yandex")).Path
$archive = Join-Path $projectRoot "game-yandex.zip"
$index = Join-Path $buildDir "index.html"

if (-not (Test-Path -LiteralPath $index -PathType Leaf)) {
  throw "dist-yandex/index.html is missing. Run npm run build:yandex first."
}

if (Test-Path -LiteralPath $archive) {
  Remove-Item -LiteralPath $archive -Force
}

$stream = [System.IO.File]::Open($archive, [System.IO.FileMode]::CreateNew)
$zip = [System.IO.Compression.ZipArchive]::new(
  $stream,
  [System.IO.Compression.ZipArchiveMode]::Create,
  $false
)

try {
  Get-ChildItem -LiteralPath $buildDir -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($buildDir.Length).TrimStart('\', '/').Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $zip,
      $_.FullName,
      $relative,
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
} finally {
  $zip.Dispose()
  $stream.Dispose()
}

Write-Output "Created $archive"
