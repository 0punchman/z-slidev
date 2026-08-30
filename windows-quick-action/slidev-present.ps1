# slidev-present.ps1
#
# Explorer context-menu friendly launcher:
# - prefers port 3030, then 3031..4000 if occupied (Slidev CLI uses strictPort)
# - reuses an already-running instance of the SAME markdown
# - watches browser TCP connections
# - automatically stops Slidev after the page is closed (~60s idle)

$ErrorActionPreference = 'Stop'

$AppDir = if ($env:SLIDEV_APP_DIR) { $env:SLIDEV_APP_DIR } else { Join-Path $env:LOCALAPPDATA 'Slidev' }
$SlidevRuntime = if ($env:SLIDEV_RUNTIME) { $env:SLIDEV_RUNTIME } else { Join-Path $AppDir 'runtime' }
$SlidevPortBase = if ($env:SLIDEV_PORT) { [int]$env:SLIDEV_PORT } else { 3030 }
$SlidevPortMax = if ($env:SLIDEV_PORT_MAX) { [int]$env:SLIDEV_PORT_MAX } else { 4000 }
$LogDir = Join-Path $env:TEMP 'slidev-present'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$script:SlidevProcess = $null

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

function Get-NpmPath {
  $cmd = Get-Command npm -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $nodeDir = Split-Path (Get-NodePath) -Parent
  if ($nodeDir) {
    foreach ($name in @('npm.cmd', 'npm.exe', 'npm')) {
      $p = Join-Path $nodeDir $name
      if (Test-Path -LiteralPath $p) { return $p }
    }
  }
  return $null
}

function Notify([string]$Message) {
  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
    Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue
    $ni = New-Object System.Windows.Forms.NotifyIcon
    $ni.Icon = [System.Drawing.SystemIcons]::Information
    $ni.Visible = $true
    $ni.BalloonTipTitle = 'Slidev'
    $ni.BalloonTipText = $Message
    $ni.ShowBalloonTip(4000)
    Start-Sleep -Milliseconds 500
    $ni.Dispose()
  } catch {
    # non-interactive / headless: ignore
  }
}

function Fail([string]$Message, [string]$LogFile = '') {
  Notify $Message
  [Console]::Error.WriteLine("slidev-present: $Message")
  if ($LogFile -and (Test-Path -LiteralPath $LogFile)) {
    Start-Process notepad.exe -ArgumentList "`"$LogFile`"" -ErrorAction SilentlyContinue
  }
  exit 1
}

function Get-ListeningPid([int]$Port) {
  $lines = & netstat -ano -p tcp 2>$null
  foreach ($line in $lines) {
    if ($line -match "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$") {
      return [int]$Matches[1]
    }
  }
  return $null
}

function Test-PortHasEstablished([int]$Port) {
  $lines = & netstat -ano -p tcp 2>$null
  foreach ($line in $lines) {
    if ($line -match "^\s*TCP\s+\S+:$Port\s+\S+\s+ESTABLISHED\s+") {
      return $true
    }
  }
  return $false
}

function Get-ListenPortOfPid([int]$ProcessId) {
  $lines = & netstat -ano -p tcp 2>$null
  foreach ($line in $lines) {
    if ($line -match "^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+$ProcessId\s*$") {
      return [int]$Matches[1]
    }
  }
  return $null
}

function Find-RunningDeckPort([string]$MarkdownPath) {
  try {
    $procs = Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
      $_.CommandLine -and (Test-IsSlidevCommand $_.CommandLine)
    }
  } catch {
    return $null
  }
  foreach ($p in $procs) {
    $holderMd = Get-MarkdownArgFromCommand $p.CommandLine
    if (-not $holderMd) { continue }
    try {
      $holderMdAbs = (Resolve-Path -LiteralPath $holderMd -ErrorAction Stop).Path
    } catch {
      $holderMdAbs = $holderMd
    }
    if ([string]::Equals($holderMdAbs, $MarkdownPath, [System.StringComparison]::OrdinalIgnoreCase)) {
      $port = Get-ListenPortOfPid ([int]$p.ProcessId)
      if ($port) { return $port }
    }
  }
  return $null
}

function Get-FreePort([int]$From, [int]$To) {
  for ($p = $From; $p -le $To; $p++) {
    if (-not (Get-ListeningPid $p)) { return $p }
  }
  return $null
}

function Test-IsSlidevCommand([string]$Cmd) {
  if ([string]::IsNullOrWhiteSpace($Cmd)) { return $false }
  if ($Cmd -match '\.pnpm[/\\]slidev\.mjs') { return $true }
  if ($Cmd -match '@slidev[/\\]cli[/\\]bin[/\\]slidev\.mjs') { return $true }
  if ($Cmd -match 'node_modules[/\\]\.bin[/\\]slidev') { return $true }
  if ($Cmd -match '(^|[\\/])slidev(\.cmd|\.exe|\.ps1)?(\s|$)' -and $Cmd -match '\.(md|markdown)(\s|$)') { return $true }
  return $false
}

function Get-MarkdownArgFromCommand([string]$Cmd) {
  if ([string]::IsNullOrWhiteSpace($Cmd)) { return $null }
  # Prefer quoted paths, then bare *.md tokens.
  $m = [regex]::Match($Cmd, '"([^"]+\.(?:md|markdown|MD|MARKDOWN))"')
  if ($m.Success) { return $m.Groups[1].Value }
  $m = [regex]::Match($Cmd, '(?<=\s)([^\s"]+\.(?:md|markdown|MD|MARKDOWN))(?=\s|$)')
  if ($m.Success) { return $m.Groups[1].Value }
  return $null
}

function Get-ProcessCommandLine([int]$ProcessId) {
  try {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction Stop
    return [string]$p.CommandLine
  } catch {
    return ''
  }
}

function Extract-FrontmatterField([string]$File, [string]$Key) {
  $lines = Get-Content -LiteralPath $File -Encoding UTF8
  $in = $false
  $pattern = "^\s*$([regex]::Escape($Key))\s*:"
  foreach ($line in $lines) {
    if ($line -match '^---\s*$') {
      if (-not $in) { $in = $true; continue }
      break
    }
    if ($in -and $line -match $pattern) {
      $val = ($line -replace $pattern, '').Trim()
      $val = $val.Trim("'`"")
      $val = ($val -replace '\s*#.*$', '').Trim()
      return $val
    }
  }
  return ''
}

function Resolve-ThemePackage([string]$Raw) {
  switch -Regex ($Raw) {
    '^$' { return '' }
    '^(default|none)$' { return '' }
    '^\.[\\/]' { return '' }
    '^[\\/]' { return '' }
    '^@[^/]+/' { return $Raw }
    '^slidev-theme-' { return $Raw }
    default { return "@slidev/theme-$Raw" }
  }
}

function Ensure-ThemeInstalled([string]$Pkg) {
  if ([string]::IsNullOrWhiteSpace($Pkg)) { return }
  $modDir = Join-Path $SlidevRuntime "node_modules\$($Pkg -replace '/', '\')"
  if (Test-Path -LiteralPath $modDir) { return }

  $npm = Get-NpmPath
  if (-not $npm) { Fail "缺主题 $Pkg 但找不到 npm，无法自动安装" }

  Notify "首次使用主题 $Pkg，正在安装…"
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $installLog = Join-Path $LogDir "install-$stamp.log"
  Push-Location $SlidevRuntime
  try {
    & $npm install --no-audit --no-fund --loglevel=error $Pkg *> $installLog
    if ($LASTEXITCODE -ne 0) { Fail "主题 $Pkg 安装失败" $installLog }
  } finally {
    Pop-Location
  }
  if (-not (Test-Path -LiteralPath $modDir)) {
    Fail "主题 $Pkg 安装后仍找不到，请检查包名" $installLog
  }
  Notify "主题 $Pkg 安装完成"
}

function Cleanup-Slidev {
  if ($script:SlidevProcess -and -not $script:SlidevProcess.HasExited) {
    $pidToKill = $script:SlidevProcess.Id
    try { $script:SlidevProcess.Kill() } catch {}
    # Kill process tree (child node workers) if still present.
    & taskkill.exe /PID $pidToKill /T /F 2>$null | Out-Null
  }
}

# ---- main ----

if ($args.Count -lt 1) {
  Fail '请选择一个 Markdown 幻灯片文件'
}

$MdInput = [string]$args[0]
if (-not (Test-Path -LiteralPath $MdInput -PathType Leaf)) {
  Fail "文件不存在：$MdInput"
}

$ext = [System.IO.Path]::GetExtension($MdInput).ToLowerInvariant()
if ($ext -notin @('.md', '.markdown')) {
  Fail '请选择 .md 幻灯片文件'
}

$MdAbs = (Resolve-Path -LiteralPath $MdInput).Path
$MdDir = Split-Path -Parent $MdAbs
$MdName = Split-Path -Leaf $MdAbs

$CliReal = Join-Path $SlidevRuntime 'node_modules\@slidev\cli\bin\slidev.mjs'
$CliEntry = Join-Path $SlidevRuntime '.pnpm\slidev.mjs'
$NodeBin = Get-NodePath

if (-not (Test-Path -LiteralPath $CliReal)) {
  Fail "找不到 Slidev 共享运行时：$SlidevRuntime"
}
if (-not $NodeBin) {
  Fail '找不到 node，请确认已安装 Node.js'
}

$ensureScript = Join-Path $AppDir 'scripts\ensure-pnpm-entry.mjs'
if (Test-Path -LiteralPath $ensureScript) {
  $env:SLIDEV_RUNTIME = $SlidevRuntime
  & $NodeBin $ensureScript
  if ($LASTEXITCODE -ne 0) { Fail '无法创建 .pnpm 入口' }
} elseif (-not (Test-Path -LiteralPath $CliEntry)) {
  Fail "缺少 CLI 入口：$CliEntry（请重新运行 install.ps1）"
}

# Port reuse / avoidance (Slidev Vite strictPort does not auto-bump)
$existingPort = Find-RunningDeckPort $MdAbs
if ($existingPort) {
  Start-Process "http://localhost:$existingPort/"
  Notify "复用已运行的 Slidev：$MdName（端口 $existingPort）"
  exit 0
}

$SlidevPort = Get-FreePort $SlidevPortBase $SlidevPortMax
if (-not $SlidevPort) {
  Fail "找不到空闲端口（已试 $SlidevPortBase–$SlidevPortMax）"
}
$SlidevUrl = "http://localhost:$SlidevPort/"
if ($SlidevPort -ne $SlidevPortBase) {
  Notify "端口 $SlidevPortBase 已被占用，改用 $SlidevPort"
}

$themeRaw = Extract-FrontmatterField $MdAbs 'theme'
$themePkg = Resolve-ThemePackage $themeRaw
Ensure-ThemeInstalled $themePkg

$postinstall = Join-Path $AppDir 'scripts\runtime-postinstall.mjs'
if (Test-Path -LiteralPath $postinstall) {
  $env:SLIDEV_RUNTIME = $SlidevRuntime
  & $NodeBin $postinstall *>> (Join-Path $LogDir 'postinstall.log')
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile = Join-Path $LogDir "$stamp.log"

try {
  # Compatible with Windows PowerShell 5.1 (.NET Framework) and PowerShell 7+.
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $NodeBin
  $psi.Arguments = "`"$CliEntry`" `"$MdAbs`" --port $SlidevPort"
  $psi.WorkingDirectory = $MdDir
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $psi.EnvironmentVariables['SLIDEV_EXTRA_FS_ALLOW'] = $SlidevRuntime
  # Strip VS Code / Cursor host markers so UnoCSS icon loader stays active.
  foreach ($k in @(
    'VSCODE_CWD', 'VSCODE_PID', 'VSCODE_IPC_HOOK', 'VSCODE_IPC_HOOK_CLI',
    'VSCODE_NLS_CONFIG', 'VSCODE_NODE_CACHED_DATA_DIR', 'ELECTRON_RUN_AS_NODE'
  )) {
    if ($psi.EnvironmentVariables.ContainsKey($k)) {
      [void]$psi.EnvironmentVariables.Remove($k)
    }
  }

  $script:SlidevProcess = New-Object System.Diagnostics.Process
  $script:SlidevProcess.StartInfo = $psi
  $outBuilder = New-Object System.Text.StringBuilder
  $errBuilder = New-Object System.Text.StringBuilder
  $null = Register-ObjectEvent -InputObject $script:SlidevProcess -EventName OutputDataReceived -MessageData $outBuilder -Action {
    if ($null -ne $EventArgs.Data) { [void]$Event.MessageData.AppendLine($EventArgs.Data) }
  }
  $null = Register-ObjectEvent -InputObject $script:SlidevProcess -EventName ErrorDataReceived -MessageData $errBuilder -Action {
    if ($null -ne $EventArgs.Data) { [void]$Event.MessageData.AppendLine($EventArgs.Data) }
  }
  [void]$script:SlidevProcess.Start()
  $script:SlidevProcess.BeginOutputReadLine()
  $script:SlidevProcess.BeginErrorReadLine()

  Notify "正在启动：$MdName"

  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    if ($script:SlidevProcess.HasExited) {
      "$( $outBuilder.ToString() )$( $errBuilder.ToString() )" | Set-Content -LiteralPath $logFile -Encoding UTF8
      Fail 'Slidev 启动失败' $logFile
    }
    try {
      $resp = Invoke-WebRequest -Uri $SlidevUrl -UseBasicParsing -TimeoutSec 2
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
        $ready = $true
        break
      }
    } catch {
      # still starting
    }
    Start-Sleep -Seconds 1
  }

  if (-not $ready) {
    "$( $outBuilder.ToString() )$( $errBuilder.ToString() )" | Set-Content -LiteralPath $logFile -Encoding UTF8
    Fail 'Slidev 启动超时' $logFile
  }

  Start-Process $SlidevUrl
  Notify "演示已打开：$MdName"

  $emptyThreshold = if ($env:SLIDEV_EMPTY_THRESHOLD) { [int]$env:SLIDEV_EMPTY_THRESHOLD } else { 30 }
  $sleepSecs = 2
  $seenConnection = $false
  $emptyTicks = 0

  while (-not $script:SlidevProcess.HasExited) {
    if (Test-PortHasEstablished $SlidevPort) {
      $seenConnection = $true
      $emptyTicks = 0
    } elseif ($seenConnection) {
      $emptyTicks++
      if ($emptyTicks -ge $emptyThreshold) {
        Notify '页面已关闭，Slidev 已停止'
        break
      }
    }
    Start-Sleep -Seconds $sleepSecs
  }

  if ($script:SlidevProcess.HasExited -and $seenConnection) {
    $code = $script:SlidevProcess.ExitCode
    if ($code -ne 0 -and $code -ne $null) {
      "$( $outBuilder.ToString() )$( $errBuilder.ToString() )" | Set-Content -LiteralPath $logFile -Encoding UTF8
      Notify 'Slidev 意外退出，正在打开日志'
      Start-Process notepad.exe -ArgumentList "`"$logFile`"" -ErrorAction SilentlyContinue
    }
  }
} finally {
  Cleanup-Slidev
}
