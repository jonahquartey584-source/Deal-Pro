#!/usr/bin/env bash
# Puts Qp Homebase on the phone privately through Tailscale (only devices
# signed in to the same Tailscale account can open it).
# Uses its own HTTPS port (8443 by default) so it never clashes with another
# Homebase already shared on the same computer.
set -euo pipefail
PORT="${PORT:-4400}"
HTTPS_PORT="${HTTPS_PORT:-8443}"
TS="$(command -v tailscale || true)"
[[ -z "$TS" && -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]] && TS=/Applications/Tailscale.app/Contents/MacOS/Tailscale
[[ -n "$TS" ]] || { echo "Install Tailscale first: https://tailscale.com/download (and sign in), then run this again." >&2; exit 1; }
curl -fsS "http://localhost:$PORT/api/health" >/dev/null || { echo "Qp Homebase isn't running. Run: bash scripts/install-mac.sh" >&2; exit 1; }

echo "Sharing http://localhost:$PORT on your private Tailscale network (HTTPS port $HTTPS_PORT)…"
echo "If it shows a link to enable Serve/HTTPS, open it, press Enable, then wait."
"$TS" serve --bg --https="$HTTPS_PORT" "http://127.0.0.1:$PORT"
NAME="$("$TS" status --json | sed -n 's/.*"DNSName": *"\([^"]*\)\.".*/\1/p' | head -1)"
echo
echo "Done. On the phone (signed in to the same Tailscale account), open in Safari:"
echo "   https://$NAME:$HTTPS_PORT"
echo "Then Share → Add to Home Screen."
