#!/usr/bin/env bash
set -euo pipefail

STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${STACK_DIR}"

echo "OpenCode OAuth bootstrap"
echo
echo "1) Zorg dat de main stack draait."
echo "2) Gebruik daarna de directe auth-routes voor GitHub Copilot, Google en Qwen."
echo "3) Qwen gebruikt nu ook de OpenCode runtime-login op /qwen-auth/."
echo
echo "Command: docker compose exec opencode-dev bash -lc 'cd /home/app/workspace && opencode'"
echo
read -r -p "Open interactieve sessie nu? [y/N] " answer
if [[ "${answer}" =~ ^[Yy]$ ]]; then
  docker compose exec opencode-dev bash -lc 'cd /home/app/workspace && opencode'
fi

echo
echo "Bekende auth/state bestanden onder persistente mounts:"
for path in \
  /opt/stacks/opencode-dev/config/opencode \
  /opt/stacks/opencode-dev/state/opencode/share \
  /opt/stacks/opencode-dev/state/opencode/state
do
  echo "-- ${path}"
  if [[ -d "${path}" ]]; then
    find "${path}" -maxdepth 2 -type f | sort || true
  else
    echo "directory missing"
  fi
done
