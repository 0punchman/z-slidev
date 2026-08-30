#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$HOME/Library/Application Support/Slidev"
RUNTIME="$APP_DIR/runtime"
SERVICE_NAME='演示模式(Slidev).workflow'
SERVICE_DST="$HOME/Library/Services/$SERVICE_NAME"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo '未找到 Node.js/npm。请先安装 Node.js 20.12 或更高版本。' >&2
  echo '推荐：brew install node' >&2
  exit 1
fi

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(`.`)[0])')"
if (( NODE_MAJOR < 20 )); then
  echo "Node.js 版本过低：$(node --version)，需要 20.12 或更高版本。" >&2
  exit 1
fi

mkdir -p "$APP_DIR/bin" "$APP_DIR/scripts" "$RUNTIME/scripts" "$HOME/Library/Services" "$HOME/.cursor/skills"
install -m 755 "$HERE/slidev-present" "$APP_DIR/bin/slidev-present"
install -m 755 "$HERE/slidev-open" "$APP_DIR/bin/slidev-open"
install -m 644 "$HERE/runtime-postinstall.mjs" "$APP_DIR/scripts/runtime-postinstall.mjs"
install -m 644 "$HERE/zh-cn-patch.mjs" "$RUNTIME/scripts/zh-cn-patch.mjs"
install -m 644 "$HERE/runtime-package.json" "$RUNTIME/package.json"
install -m 644 "$HERE/runtime-package-lock.json" "$RUNTIME/package-lock.json"

(
  cd "$RUNTIME"
  npm ci --no-audit --no-fund
  SLIDEV_RUNTIME="$RUNTIME" node "$APP_DIR/scripts/runtime-postinstall.mjs"
  node "$RUNTIME/scripts/zh-cn-patch.mjs"
)

rm -rf "$SERVICE_DST"
cp -R "$HERE/$SERVICE_NAME" "$SERVICE_DST"

# Install the bundled official Skill so Cursor agents can discover it even if
# the source repository is moved or absent on the next Mac.
rm -rf "$HOME/.cursor/skills/slidev"
cp -R "$HERE/slidev-skill" "$HOME/.cursor/skills/slidev"

# Optional terminal aliases. Finder workflow calls APP_DIR directly and does
# not depend on these, so installation works on Intel and Apple Silicon Macs.
BIN_DIR=''
if [[ -d /opt/homebrew/bin && -w /opt/homebrew/bin ]]; then
  BIN_DIR=/opt/homebrew/bin
elif [[ -d /usr/local/bin && -w /usr/local/bin ]]; then
  BIN_DIR=/usr/local/bin
fi
if [[ -n "$BIN_DIR" ]]; then
  ln -sfn "$APP_DIR/bin/slidev-present" "$BIN_DIR/slidev-present"
  ln -sfn "$APP_DIR/bin/slidev-open" "$BIN_DIR/slidev-open"
  ln -sfn "$RUNTIME/node_modules/.bin/slidev" "$BIN_DIR/slidev"
fi

/usr/bin/plutil -lint "$SERVICE_DST/Contents/Info.plist" "$SERVICE_DST/Contents/document.wflow"
/System/Library/CoreServices/pbs -flush >/dev/null 2>&1 || true
/System/Library/CoreServices/pbs -update >/dev/null 2>&1 || true
/usr/bin/killall Finder >/dev/null 2>&1 || true

echo "安装完成：Finder 右键 Markdown 文件 → 快速操作 → 演示模式(Slidev)"
echo "Slidev 版本：$(node -p "require('$RUNTIME/node_modules/@slidev/cli/package.json').version")"
