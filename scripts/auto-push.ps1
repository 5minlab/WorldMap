# Auto-commit and push on local file changes (Windows PowerShell)
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/auto-push.ps1

param(
  [int]$DebounceMs = 2000,
  [int]$IntervalMs = 500
)

$ErrorActionPreference = 'Stop'

function Exec($cmd, $allowFail=$false) {
  try {
    Write-Host "→ $cmd" -ForegroundColor Cyan
    & powershell -NoLogo -NoProfile -Command $cmd
  } catch {
    if (-not $allowFail) { throw }
    Write-Warning $_
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
Set-Location $repoRoot

# Ensure git identity is set (optional)
try {
  $name = git config user.name
  $email = git config user.email
  if (-not $name -or -not $email) {
    Write-Warning "git user.name/user.email 이 설정되지 않았습니다. 커밋이 거부될 수 있어요."
  }
} catch {}

$fsw = New-Object System.IO.FileSystemWatcher
$fsw.Path = $repoRoot
$fsw.Filter = '*.*'
$fsw.IncludeSubdirectories = $true
$fsw.EnableRaisingEvents = $true

$global:changeFlag = $false

$handler = Register-ObjectEvent $fsw Changed -Action {
  $path = $Event.SourceEventArgs.FullPath
  if ($path -match '\\.git(\\|$)' -or $path -match 'WorldMap(\\|$)') { return }
  $global:changeFlag = $true
}
Register-ObjectEvent $fsw Created -Action { $global:changeFlag = $true } | Out-Null
Register-ObjectEvent $fsw Deleted -Action { $global:changeFlag = $true } | Out-Null
Register-ObjectEvent $fsw Renamed -Action { $global:changeFlag = $true } | Out-Null

Write-Host "Auto-push watcher 시작: $repoRoot" -ForegroundColor Green
Write-Host "중지하려면 창을 닫거나 Ctrl+C 를 누르세요." -ForegroundColor Yellow

while ($true) {
  Start-Sleep -Milliseconds $IntervalMs
  if (-not $global:changeFlag) { continue }
  # debounce
  Start-Sleep -Milliseconds $DebounceMs
  $global:changeFlag = $false

  # Check for real changes
  $status = git status --porcelain
  if (-not $status) { continue }

  $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  try {
    Exec 'git add -A'
    Exec "git commit -m 'chore(auto): save at $ts'" $true
    # Optional: rebase to avoid diverging
    Exec 'git pull --rebase' $true
    Exec 'git push'
    Write-Host "✓ 자동 푸시 완료: $ts" -ForegroundColor Green
  } catch {
    Write-Warning "자동 푸시 실패: $_"
  }
}

