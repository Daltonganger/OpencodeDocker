#!/usr/bin/env bash
set -euo pipefail

cd /home/app/workspace

backend_url="${OPENCODE_BACKEND_URL:-http://opencode-backend:4096}"

while true; do
  clear || true
  printf '\n[OpenCode] attaching to %s...\n\n' "$backend_url"
  opencode attach "$backend_url" --dir /home/app/workspace --continue
  status=$?
  printf '\n[OpenCode] exited with status %s. Restarting in 1 second...\n' "$status"
  sleep 1
done
