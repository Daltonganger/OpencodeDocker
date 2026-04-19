#!/usr/bin/env bash
set -euo pipefail

interval_hours="${OPENCODE_UPDATER_INTERVAL_HOURS:-6}"
if ! [[ "$interval_hours" =~ ^[0-9]+$ ]] || [ "$interval_hours" -lt 1 ]; then
  interval_hours=6
fi
interval_seconds=$((interval_hours * 3600))

while true; do
  bash /updater/update-once.sh || true
  sleep "$interval_seconds"
done
