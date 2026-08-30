@echo off
REM Hidden launcher for Explorer context menu. Returns immediately.
setlocal
set "APP_DIR=%LOCALAPPDATA%\Slidev"
set "VBS=%APP_DIR%\bin\launch-hidden.vbs"
set "PS1=%APP_DIR%\bin\slidev-present.ps1"
if not exist "%VBS%" (
  echo slidev-present: missing %VBS%. Re-run install.ps1.
  exit /b 1
)
if "%~1"=="" (
  wscript.exe //nologo "%VBS%" "%PS1%"
) else (
  wscript.exe //nologo "%VBS%" "%PS1%" "%~1"
)
endlocal
