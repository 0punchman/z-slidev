# slidev-open.ps1
#
# Foreground launcher: shared centralized runtime, port avoidance, auto-open browser.
# The .md folder stays clean — no local package.json / node_modules required.

$ErrorActionPreference = 'Stop'

$AppDir = if ($env:SLIDEV_APP_DIR) { $env:SLIDEV_APP_DIR } else { Join-Path $env:LOCALAPPDATA 'Slidev' }
$SlidevRuntime = if ($env:SLIDEV_RUNTIME) { $env:SLIDEV_RUNTIME } else { Join-Path $AppDir 'runtime' }
$SlidevPortBase = if ($env:SLIDEV_PORT) { [int]$env:SLIDEV_PORT } else { 3030 }
$SlidevPortMax = if ($env:SLIDEV_PORT_MAX) { [int]$env:SLIDEV_PORT_MAX } else { 4000 }

function Get-NodePath {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($cand in @(
    (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\node\node.exe')
  )) {
    if ($cand -and (Test-Path -LiteralPath $cand)) { return $cand }
  }
  return $null
}

if ($args.Count -lt 1) {
  @"
Usage: slidev-open <markdown-file>

Examples:
  slidev-open .\slides.md
  slidev-open D:\decks\2026-kickoff.md

Env:
  SLIDEV_RUNTIME  Path to the shared Slidev runtime directory.
  SLIDEV_PORT     Preferred port (default 3030). Occupied ports bump up to SLIDEV_PORT_MAX.
  SLIDEV_PORT_MAX Upper bound for port avoidance (default 4000).
"@ | Write-Host
  exit 1
}

$MdInput = [string]$args[0]
if (-not (Test-Path -LiteralPath $MdInput -PathType Leaf)) {
  Write-Error "slidev-open: file not found: $MdInput"
  exit 1
}

$MdAbs = (Resolve-Path -LiteralPath $MdInput).Path
$MdDir = Split-Path -Parent $MdAbs
$CliReal = Join-Path $SlidevRuntime 'node_modules\@slidev\cli\bin\slidev.mjs'
$CliEntry = Join-Path $SlidevRuntime '.pnpm\slidev.mjs'
$NodeBin = Get-NodePath

if (-not (Test-Path -LiteralPath $CliReal)) {
  Write-Error "slidev-open: Slidev runtime not found at $SlidevRuntime"
  Write-Error '             Re-run install.ps1 or set SLIDEV_RUNTIME.'
  exit 1
}
if (-not $NodeBin) {
  Write-Error 'slidev-open: node not found; install Node.js or fix PATH'
  exit 1
}

$ensureScript = Join-Path $AppDir 'scripts\ensure-pnpm-entry.mjs'
if (Test-Path -LiteralPath $ensureScript) {
  $env:SLIDEV_RUNTIME = $SlidevRuntime
  & $NodeBin $ensureScript
} elseif (-not (Test-Path -LiteralPath $CliEntry)) {
  Write-Error "slidev-open: missing CLI entry $CliEntry"
  exit 1
}

$postinstall = Join-Path $AppDir 'scripts\runtime-postinstall.mjs'
if (Test-Path -LiteralPath $postinstall) {
  $env:SLIDEV_RUNTIME = $SlidevRuntime
  & $NodeBin $postinstall 2>$null | Out-Null
}

function Test-PortFree([int]$Port) {
  $lines = & netstat -ano -p tcp 2>$null
  foreach ($line in $lines) {
    if ($line -match "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+") { return $false }
  }
  return $true
}

$SlidevPort = $null
for ($p = $SlidevPortBase; $p -le $SlidevPortMax; $p++) {
  if (Test-PortFree $p) { $SlidevPort = $p; break }
}
if (-not $SlidevPort) {
  Write-Error "slidev-open: no free port in $SlidevPortBase–$SlidevPortMax"
  exit 1
}

Write-Host "slidev-open: deck    = $MdAbs"
Write-Host "slidev-open: runtime = $SlidevRuntime"
Write-Host "slidev-open: port    = $SlidevPort (preferred $SlidevPortBase, auto-opening browser)"
Write-Host ''

# Clear VS Code / Cursor markers for UnoCSS icon loading.
foreach ($k in @(
  'VSCODE_CWD', 'VSCODE_PID', 'VSCODE_IPC_HOOK', 'VSCODE_IPC_HOOK_CLI',
  'VSCODE_NLS_CONFIG', 'VSCODE_NODE_CACHED_DATA_DIR', 'ELECTRON_RUN_AS_NODE'
)) {
  Remove-Item -Path "Env:$k" -ErrorAction SilentlyContinue
}

$env:SLIDEV_EXTRA_FS_ALLOW = $SlidevRuntime
Set-Location -LiteralPath $MdDir
& $NodeBin $CliEntry $MdAbs --port $SlidevPort --open
exit $LASTEXITCODE
