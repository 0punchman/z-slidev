#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$HOME/Library/Application Support/Slidev"
RUNTIME="$APP_DIR/runtime"
SERVICE="$HOME/Library/Services/演示模式(Slidev).workflow"

check_file() { [[ -f "$1" ]] || { echo "缺少文件：$1" >&2; exit 1; }; }
check_file "$APP_DIR/bin/slidev-present"
check_file "$APP_DIR/scripts/runtime-postinstall.mjs"
check_file "$RUNTIME/node_modules/@slidev/cli/bin/slidev.mjs"
check_file "$SERVICE/Contents/Info.plist"
check_file "$SERVICE/Contents/document.wflow"
check_file "$HOME/.cursor/skills/slidev/SKILL.md"
/usr/bin/plutil -lint "$SERVICE/Contents/Info.plist" "$SERVICE/Contents/document.wflow" >/dev/null
bash -n "$APP_DIR/bin/slidev-present"
SLIDEV_RUNTIME="$RUNTIME" node "$APP_DIR/scripts/runtime-postinstall.mjs"
node "$RUNTIME/scripts/zh-cn-patch.mjs" >/dev/null

SLIDEV_COMMAND="$(command -v slidev || true)"
[[ -n "$SLIDEV_COMMAND" ]] || { echo "找不到全局 slidev 命令链接" >&2; exit 1; }

echo "快速操作配置正常"
echo "Skill：$HOME/.cursor/skills/slidev/SKILL.md"
echo "CLI：$SLIDEV_COMMAND"
echo "Slidev：$(node -p "require('$RUNTIME/node_modules/@slidev/cli/package.json').version")"
echo "Node.js：$(node --version)"
