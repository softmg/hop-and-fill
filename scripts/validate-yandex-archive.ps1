$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = Split-Path -Parent $PSScriptRoot
$archive = Join-Path $projectRoot "game-yandex.zip"

if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) {
  throw "game-yandex.zip is missing. Run npm run package:yandex first."
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($archive)

try {
  $entries = @($zip.Entries)
  if (-not ($entries | Where-Object { $_.FullName -ceq "index.html" })) {
    throw "game-yandex.zip has no root index.html entry."
  }

  $badSeparators = @($entries | Where-Object { $_.FullName.Contains("\") })
  if ($badSeparators.Count -gt 0) {
    throw "game-yandex.zip contains Windows path separators: $($badSeparators[0].FullName)"
  }

  if (-not ($entries | Where-Object { $_.FullName -clike "assets/*" })) {
    throw "game-yandex.zip has no assets/ entries."
  }
} finally {
  $zip.Dispose()
}

Write-Output "Yandex archive validation passed."
