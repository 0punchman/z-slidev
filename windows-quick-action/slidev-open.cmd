@echo off
setlocal
set "APP_DIR=%LOCALAPPDATA%\Slidev"
set "PS1=%APP_DIR%\bin\slidev-open.ps1"
if not exist "%PS1%" set "PS1=%~dp0slidev-open.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
exit /b %ERRORLEVEL%
