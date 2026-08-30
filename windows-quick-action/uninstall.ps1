# uninstall.ps1 — 卸载 Windows「演示模式(Slidev)」
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1

$ErrorActionPreference = 'Stop'

$AppDir = Join-Path $env:LOCALAPPDATA 'Slidev'
$BinDir = Join-Path $AppDir 'bin'
$MenuKey = 'SlidevPresent'

foreach ($ext in @('.md', '.markdown')) {
  $base = "HKCU:\Software\Classes\SystemFileAssociations\$ext\shell\$MenuKey"
  if (Test-Path -LiteralPath $base) {
    Remove-Item -LiteralPath $base -Recurse -Force
  }
}

# 仅移除本安装写入的 PATH 条目
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath) {
  $kept = $userPath -split ';' | Where-Object {
    $_ -and ($_.TrimEnd('\') -ne $BinDir.TrimEnd('\'))
  }
  [Environment]::SetEnvironmentVariable('Path', ($kept -join ';'), 'User')
}

if (Test-Path -LiteralPath $AppDir) {
  Remove-Item -LiteralPath $AppDir -Recurse -Force
}

Write-Host '已卸载演示模式(Slidev)。不会删除 Markdown 文件或本仓库目录。'
