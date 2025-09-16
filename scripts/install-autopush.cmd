@echo off
REM Install scheduled task to auto-run auto-push watcher at user logon
setlocal
set SCRIPT_DIR=%~dp0
set PS1=%SCRIPT_DIR%install-autopush-scheduler.ps1
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
endlocal

