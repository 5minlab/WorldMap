param([int]$Port=8000)
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $here 'stop-dev-server.ps1') -Port $Port
Start-Sleep -Seconds 1
& (Join-Path $here 'start-dev-server.ps1') -Port $Port
