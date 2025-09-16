# Start a local dev server from the repository root and open the globe page.
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/start-dev-server.ps1 [-Port 8000]

param(
  [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

function Has-Cmd($name){ try { $null = Get-Command $name -ErrorAction Stop; return $true } catch { return $false } }

if (-not (Has-Cmd 'python') -and -not (Has-Cmd 'py')) {
  Write-Error "Python이 설치되어 있어야 합니다. https://www.python.org/downloads/ 에서 설치 후 다시 실행하세요."
}

$python = if (Has-Cmd 'py') { 'py' } else { 'python' }

# Start the HTTP server detached
$args = @('-m','http.server',"$Port",'--bind','0.0.0.0')
Write-Host "레포 루트에서 서버 시작: http://localhost:$Port" -ForegroundColor Green
Start-Process -WindowStyle Minimized -WorkingDirectory $repoRoot -FilePath $python -ArgumentList $args | Out-Null

# Open both v2 and v1 pages
$urlV2 = "http://localhost:$Port/docs/globe2/"
$urlV1 = "http://localhost:$Port/docs/globe/"
Start-Process $urlV2 | Out-Null
Start-Process $urlV1 | Out-Null

Write-Host "브라우저가 열리지 않으면 아래 주소를 직접 여세요:" -ForegroundColor Yellow
Write-Host "  $urlV2" -ForegroundColor Cyan
Write-Host "  $urlV1" -ForegroundColor Cyan

