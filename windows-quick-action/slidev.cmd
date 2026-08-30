@echo off
REM Thin wrapper so `slidev` resolves to the shared runtime CLI.
setlocal
set "APP_DIR=%LOCALAPPDATA%\Slidev"
set "RUNTIME=%APP_DIR%\runtime"
set "ENTRY=%RUNTIME%\.pnpm\slidev.mjs"
set "NODE="
where node >nul 2>nul && for /f "delims=" %%i in ('where node') do (
  set "NODE=%%i"
  goto :found
)
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE if exist "%LOCALAPPDATA%\Programs\node\node.exe" set "NODE=%LOCALAPPDATA%\Programs\node\node.exe"
:found
if not defined NODE (
  echo slidev: node not found
  exit /b 1
)
if not exist "%ENTRY%" (
  if exist "%APP_DIR%\scripts\ensure-pnpm-entry.mjs" (
    set "SLIDEV_RUNTIME=%RUNTIME%"
    "%NODE%" "%APP_DIR%\scripts\ensure-pnpm-entry.mjs"
  )
)
if not exist "%ENTRY%" (
  echo slidev: runtime missing. Run install.ps1 first.
  exit /b 1
)
set "SLIDEV_EXTRA_FS_ALLOW=%RUNTIME%"
"%NODE%" "%ENTRY%" %*
exit /b %ERRORLEVEL%
