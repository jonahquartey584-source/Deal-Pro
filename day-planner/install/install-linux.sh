#!/usr/bin/env bash
# Keeps Day Planner running on Linux with a systemd user service: starts it now,
# at every login, and restarts it if it stops. Run:  bash install/install-linux.sh
# Remove with:                                       bash install/install-linux.sh --uninstall
set -euo pipefail

UNIT="day-planner.service"
UNIT_DIR="$HOME/.config/systemd/user"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-4321}"

if [[ "${1:-}" == "--uninstall" ]]; then
  systemctl --user disable --now "$UNIT" 2>/dev/null || true
  rm -f "$UNIT_DIR/$UNIT"
  systemctl --user daemon-reload
  echo "Day Planner will no longer start automatically. Your data is still in $APP_DIR/data"
  exit 0
fi

NODE="$(command -v node || true)"
if [[ -z "$NODE" ]]; then
  echo "Node.js isn't installed. Install Node 18 or newer, then run this again." >&2
  exit 1
fi

echo "Installing dependencies…"
(cd "$APP_DIR" && npm install --omit=dev --no-audit --no-fund)
mkdir -p "$APP_DIR/data" "$UNIT_DIR"

cat > "$UNIT_DIR/$UNIT" <<EOF
[Unit]
Description=Day Planner (http://localhost:$PORT)
After=network.target

[Service]
WorkingDirectory=$APP_DIR
ExecStart=$NODE $APP_DIR/server.mjs
Environment=PORT=$PORT
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "$UNIT"
# Lets it start at boot, before you log in. Harmless if not allowed.
loginctl enable-linger "$USER" 2>/dev/null || true

sleep 2
if curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
  echo "Day Planner is running at http://localhost:$PORT and will start automatically."
  (xdg-open "http://localhost:$PORT" >/dev/null 2>&1 &) || true
else
  echo "Installed, but it didn't answer yet. Check: journalctl --user -u $UNIT"
fi
