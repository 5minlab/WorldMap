# Stop Python http.server processes for the given port (default 8000)
param([int]$Port=8000)
$ErrorActionPreference='Stop'
Write-Host "Stopping http.server on port $Port ..."
$procs = Get-CimInstance Win32_Process | Where-Object {
  ($_.CommandLine -match 'http\.server') -and ($_.CommandLine -match "\s$Port(\s|$)")
}
if ($procs) {
  $procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Write-Host "✓ Stopped $(($procs|Measure-Object).Count) process(es)."
} else {
  Write-Host "No http.server process found for port $Port."
}

