# verify.ps1 — 检查安装是否完整
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1

$ErrorActionPreference = 'Stop'

$AppDir = Join-Path $env:LOCALAPPDATA 'Slidev'
$Runtime = Join-Path $AppDir 'runtime'
$MenuKey = 'SlidevPresent'

function Check-File([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "缺少文件：$Path"
  }
}

Check-File (Join-Path $AppDir 'bin\slidev-present.ps1')
Check-File (Join-Path $AppDir 'bin\slidev-present.cmd')
Check-File (Join-Path $AppDir 'bin\launch-hidden.vbs')
Check-File (Join-Path $AppDir 'scripts\runtime-postinstall.mjs')
Check-File (Join-Path $AppDir 'scripts\ensure-pnpm-entry.mjs')
Check-File (Join-Path $Runtime 'node_modules\@slidev\cli\bin\slidev.mjs')

foreach ($ext in @('.md', '.markdown')) {
  $cmdKey = "HKCU:\Software\Classes\SystemFileAssociations\$ext\shell\$MenuKey\command"
  if (-not (Test-Path -LiteralPath $cmdKey)) {
    throw "缺少右键菜单注册：$cmdKey"
  }
}

$env:SLIDEV_RUNTIME = $Runtime
& node (Join-Path $AppDir 'scripts\runtime-postinstall.mjs') | Out-Null
& node (Join-Path $AppDir 'scripts\ensure-pnpm-entry.mjs') | Out-Null
& node (Join-Path $Runtime 'scripts\zh-cn-patch.mjs') | Out-Null

$slidevCmd = Get-Command slidev -ErrorAction SilentlyContinue
if (-not $slidevCmd) {
  # PATH 可能尚未刷新（当前会话在安装前打开）
  $fallback = Join-Path $AppDir 'bin\slidev.cmd'
  if (-not (Test-Path -LiteralPath $fallback)) {
    throw '找不到 slidev 命令'
  }
  Write-Host "提示：当前会话 PATH 尚未包含 bin，可直接用：$fallback"
} else {
  Write-Host "CLI：$($slidevCmd.Source)"
}

$ver = & node -e "console.log(require(process.argv[1]).version)" (Join-Path $Runtime 'node_modules\@slidev\cli\package.json')

Write-Host '右键菜单配置正常'
Write-Host "Slidev：$ver"
Write-Host "Node.js：$(node --version)"
Write-Host "安装目录：$AppDir"
