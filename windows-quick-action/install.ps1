# install.ps1 — Windows 一键安装「演示模式(Slidev)」资源管理器右键菜单
# 用法（在本目录）:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1

$ErrorActionPreference = 'Stop'

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Join-Path $env:LOCALAPPDATA 'Slidev'
$Runtime = Join-Path $AppDir 'runtime'
$BinDir = Join-Path $AppDir 'bin'
$ScriptsDir = Join-Path $AppDir 'scripts'
$MenuLabel = '演示模式(Slidev)'
$MenuKey = 'SlidevPresent'

function Get-NodeMajor {
  $v = & node -p "process.versions.node" 2>$null
  if (-not $v) { return 0 }
  return [int]($v.Split('.')[0])
}

function Ensure-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "未找到 $Name。请先安装 Node.js 20.12 或更高版本（https://nodejs.org/）。"
  }
}

Ensure-Command 'node'
Ensure-Command 'npm'
$major = Get-NodeMajor
if ($major -lt 20) {
  throw "Node.js 版本过低：$(node --version)，需要 20.12 或更高版本。"
}

New-Item -ItemType Directory -Force -Path $BinDir, $ScriptsDir, (Join-Path $Runtime 'scripts') | Out-Null

$copies = @(
  @{ Src = 'slidev-present.ps1'; Dst = (Join-Path $BinDir 'slidev-present.ps1') }
  @{ Src = 'slidev-open.ps1';     Dst = (Join-Path $BinDir 'slidev-open.ps1') }
  @{ Src = 'slidev-present.cmd';  Dst = (Join-Path $BinDir 'slidev-present.cmd') }
  @{ Src = 'slidev-open.cmd';      Dst = (Join-Path $BinDir 'slidev-open.cmd') }
  @{ Src = 'slidev.cmd';           Dst = (Join-Path $BinDir 'slidev.cmd') }
  @{ Src = 'launch-hidden.vbs';   Dst = (Join-Path $BinDir 'launch-hidden.vbs') }
  @{ Src = 'runtime-postinstall.mjs'; Dst = (Join-Path $ScriptsDir 'runtime-postinstall.mjs') }
  @{ Src = 'ensure-pnpm-entry.mjs';    Dst = (Join-Path $ScriptsDir 'ensure-pnpm-entry.mjs') }
  @{ Src = 'zh-cn-patch.mjs';          Dst = (Join-Path $Runtime 'scripts\zh-cn-patch.mjs') }
  @{ Src = 'remote-view-patch.mjs';    Dst = (Join-Path $Runtime 'scripts\remote-view-patch.mjs') }
  @{ Src = 'runtime-package.json';     Dst = (Join-Path $Runtime 'package.json') }
  @{ Src = 'runtime-package-lock.json'; Dst = (Join-Path $Runtime 'package-lock.json') }
)

foreach ($c in $copies) {
  $srcPath = Join-Path $Here $c.Src
  if (-not (Test-Path -LiteralPath $srcPath)) {
    throw "缺少安装文件：$srcPath"
  }
  Copy-Item -LiteralPath $srcPath -Destination $c.Dst -Force
}

Push-Location $Runtime
try {
  & npm ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm ci 失败' }
  $env:SLIDEV_RUNTIME = $Runtime
  & node (Join-Path $ScriptsDir 'runtime-postinstall.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'runtime-postinstall 失败' }
  & node (Join-Path $ScriptsDir 'ensure-pnpm-entry.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'ensure-pnpm-entry 失败' }
  & node (Join-Path $Runtime 'scripts\remote-view-patch.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'remote-view-patch 失败' }
  & node (Join-Path $Runtime 'scripts\zh-cn-patch.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'zh-cn-patch 失败' }
} finally {
  Pop-Location
}

# 用户 PATH：加入 %LOCALAPPDATA%\Slidev\bin
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not $userPath) { $userPath = '' }
$pathParts = $userPath -split ';' | Where-Object { $_ -and $_.Trim() -ne '' }
if ($pathParts -notcontains $BinDir) {
  $newPath = if ($userPath.Trim() -eq '') { $BinDir } else { "$userPath;$BinDir" }
  [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
  $env:Path = "$env:Path;$BinDir"
}

# 资源管理器右键菜单（HKCU，无需管理员）
# SystemFileAssociations 不依赖哪个程序「占用」了 .md 关联。
$presentCmd = "`"$BinDir\slidev-present.cmd`" `"%1`""
foreach ($ext in @('.md', '.markdown')) {
  $base = "HKCU:\Software\Classes\SystemFileAssociations\$ext\shell\$MenuKey"
  New-Item -Path $base -Force | Out-Null
  New-Item -Path "$base\command" -Force | Out-Null
  Set-ItemProperty -Path $base -Name '(default)' -Value $MenuLabel
  Set-ItemProperty -Path $base -Name 'Icon' -Value 'imageres.dll,-102'
  Set-ItemProperty -Path "$base\command" -Name '(default)' -Value $presentCmd
}

$cliPkg = Join-Path $Runtime 'node_modules\@slidev\cli\package.json'
$ver = & node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).version)" $cliPkg

Write-Host ''
Write-Host "安装完成：资源管理器右键 Markdown 文件 → $MenuLabel"
Write-Host "安装目录：$AppDir"
Write-Host "Slidev 版本：$ver"
Write-Host '若菜单未立即出现，可重启资源管理器或重新登录一次。'
Write-Host '新开的终端才能立刻使用 slidev / slidev-open / slidev-present 命令。'
