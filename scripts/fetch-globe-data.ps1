# Fetch globe data files (countries-110m, land-110m, countries.json)
# Usage: powershell -ExecutionPolicy Bypass -File scripts/fetch-globe-data.ps1

$ErrorActionPreference = 'Stop'

function Get-File($url, $outPath) {
  Write-Host "Downloading $url -> $outPath" -ForegroundColor Cyan
  $outDir = Split-Path $outPath -Parent
  if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
  try {
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $outPath
  } catch {
    Write-Error "Failed to download: $url`n$_"
    throw
  }
}

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$dataDir = Join-Path $root 'docs/globe/data'

Get-File 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json' (Join-Path $dataDir 'countries-110m.json')
Get-File 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json' (Join-Path $dataDir 'land-110m.json')
Get-File 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json' (Join-Path $dataDir 'countries.json')

Write-Host "✓ Done. Files saved to $dataDir" -ForegroundColor Green

