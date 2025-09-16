@echo off
setlocal
set PS1=%~dp0restart-dev-server.ps1
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
endlocal

