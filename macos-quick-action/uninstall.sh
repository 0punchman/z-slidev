#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$HOME/Library/Application Support/Slidev"
SERVICE_DST="$HOME/Library/Services/演示模式(Slidev).workflow"

rm -rf "$SERVICE_DST"
for link in /opt/homebrew/bin/slidev-present /opt/homebrew/bin/slidev-open /usr/local/bin/slidev-present /usr/local/bin/slidev-open /opt/homebrew/bin/slidev /usr/local/bin/slidev; do
  if [[ -L "$link" && "$(readlink "$link")" == "$APP_DIR/bin/"* ]]; then
    rm -f "$link"
  fi
done
rm -rf "$APP_DIR"
rm -rf "$HOME/.cursor/skills/slidev"
/System/Library/CoreServices/pbs -flush >/dev/null 2>&1 || true
/System/Library/CoreServices/pbs -update >/dev/null 2>&1 || true
/usr/bin/killall Finder >/dev/null 2>&1 || true
echo '已卸载演示模式(Slidev)。'
