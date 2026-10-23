@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-NetClaw.ps1" %*
if errorlevel 1 (
  echo.
  echo NetClaw did not start successfully. Review the error above.
  pause
)
