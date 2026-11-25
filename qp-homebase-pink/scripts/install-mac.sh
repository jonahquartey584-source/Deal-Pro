#!/usr/bin/env bash
# Keeps Qp Homebase Ruby Edition running on a Mac: starts it now, at every
# login, and restarts it if it stops.   Run:  bash scripts/install-mac.sh
# Remove with:                                bash scripts/install-mac.sh --uninstall
set -euo pipefail
LABEL="com.qphomebase.pink"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-4400}"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Qp Homebase Ruby Edition will no longer start automatically. Your data is still in $APP_DIR/data"
  exit 0
fi

case "$APP_DIR" in
  "$HOME/Downloads"*|"$HOME/Desktop"*|"$HOME/Documents"*)
    echo "macOS won't let a background app read files in Downloads, Desktop or Documents." >&2
    echo "Move the folder to your home folder first, then run this again:" >&2
    echo "  mv \"$APP_DIR\" ~/qp-homebase-pink && cd ~/qp-homebase-pink && bash scripts/install-mac.sh" >&2
    exit 1 ;;
esac

NODE="$(command -v node || true)"
[[ -n "$NODE" ]] || { echo "Node.js isn't installed. Get it from https://nodejs.org (LTS), then run this again." >&2; exit 1; }
mkdir -p "$APP_DIR/data" "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$APP_DIR/server.mjs</string></array>
  <key>WorkingDirectory</key><string>$APP_DIR</string>
  <key>EnvironmentVariables</key><dict><key>PORT</key><string>$PORT</string></dict>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$APP_DIR/data/server.log</string>
  <key>StandardErrorPath</key><string>$APP_DIR/data/server.log</string>
</dict></plist>
PL

DOMAIN="gui/$(id -u)"
# stop the old copy and wait until macOS has really unloaded it (avoids "Load failed: 5: Input/output error")
launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
for _ in $(seq 1 20); do launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1 || break; sleep 0.5; done
started=""
for _ in 1 2 3 4 5; do
  if launchctl bootstrap "$DOMAIN" "$PLIST" 2>/dev/null; then started=1; break; fi
  if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then launchctl kickstart -k "$DOMAIN/$LABEL" 2>/dev/null && { started=1; break; }; fi
  sleep 1
done
[ -n "$started" ] || launchctl load -w "$PLIST" 2>/dev/null || true
ok=""
for _ in $(seq 1 20); do curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1 && { ok=1; break; }; sleep 0.5; done
if [ -n "$ok" ]; then
  echo "Qp Homebase Ruby Edition is running at http://localhost:$PORT and will start every time you log in."
  open "http://localhost:$PORT" || true
  echo "Next, for the phone:  bash scripts/phone.sh"
else
  echo "Installed, but it didn't answer yet. Wait 10 seconds and run this script again, or check $APP_DIR/data/server.log"
fi
