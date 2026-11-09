#!/usr/bin/env bash
# Keeps Day Planner running on a Mac: starts it now, at every login, and
# restarts it if it ever stops. Run:  bash install/install-mac.sh
# Remove with:                        bash install/install-mac.sh --uninstall
set -euo pipefail

LABEL="com.dayplanner.app"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-4321}"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Day Planner will no longer start automatically. Your data is still in $APP_DIR/data"
  exit 0
fi

case "$APP_DIR" in
  "$HOME/Downloads"*|"$HOME/Desktop"*|"$HOME/Documents"*)
    echo "macOS won't let a background app read files in Downloads, Desktop or Documents." >&2
    echo "Move the folder to your home folder first, then run this again:" >&2
    echo "  mv \"$APP_DIR\" ~/day-planner && cd ~/day-planner && bash install/install-mac.sh" >&2
    exit 1
    ;;
esac

NODE="$(command -v node || true)"
if [[ -z "$NODE" ]]; then
  echo "Node.js isn't installed. Get it from https://nodejs.org (LTS), then run this again." >&2
  exit 1
fi

echo "Installing dependencies…"
(cd "$APP_DIR" && npm install --omit=dev --no-audit --no-fund)
mkdir -p "$APP_DIR/data" "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$APP_DIR/server.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$APP_DIR</string>
  <key>EnvironmentVariables</key>
  <dict><key>PORT</key><string>$PORT</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$APP_DIR/data/server.log</string>
  <key>StandardErrorPath</key><string>$APP_DIR/data/server.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl load -w "$PLIST"

sleep 2
if curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
  echo "Day Planner is running at http://localhost:$PORT and will start every time you log in."
  open "http://localhost:$PORT" || true
else
  echo "Installed, but it didn't answer yet. Check $APP_DIR/data/server.log"
fi
