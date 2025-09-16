# Registers a Windows Scheduled Task to auto-run the repo's auto-push watcher at logon.
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/install-autopush-scheduler.ps1
# Optional params:
#   -TaskName "WorldMap AutoPush" -Remove (to uninstall)

param(
  [string]$TaskName = 'WorldMap AutoPush',
  [switch]$Remove
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$watcher = (Resolve-Path (Join-Path $repoRoot 'scripts/auto-push.ps1')).Path

if ($Remove) {
  Write-Host "Removing scheduled task '$TaskName'..." -ForegroundColor Yellow
  schtasks /Delete /TN "$TaskName" /F | Out-Null
  Write-Host "✓ Removed" -ForegroundColor Green
  exit 0
}

if (-not (Test-Path $watcher)) {
  Write-Error "Watcher not found: $watcher"
  exit 1
}

$pwsh = (Get-Command powershell -ErrorAction SilentlyContinue).Source
if (-not $pwsh) { Write-Error 'PowerShell not found in PATH'; exit 1 }

$cmd = "`"$pwsh`" -NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watcher`""

Write-Host "Registering scheduled task '$TaskName'..." -ForegroundColor Cyan
schtasks /Create /TN "$TaskName" /TR "$cmd" /SC ONLOGON /RL HIGHEST /F | Out-Null
Write-Host "✓ Installed. It will run on next login (hidden window)." -ForegroundColor Green

