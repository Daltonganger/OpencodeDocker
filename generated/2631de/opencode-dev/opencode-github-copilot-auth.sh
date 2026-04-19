#!/usr/bin/env bash
set -euo pipefail

mkdir -p /shared /home/app/workspace /home/app/.config/opencode /home/app/.qwen /home/app/.local/share/opencode /home/app/.local/state/opencode /home/app/.cache/opencode
chown -R app:app \
  /shared \
  /home/app/workspace \
  /home/app/.config/opencode \
  /home/app/.qwen \
  /home/app/.local/share/opencode \
  /home/app/.local/state/opencode \
  /home/app/.cache/opencode

exec gosu app bash -lc '
tmux_base=(tmux -f "/home/app/.config/opencode/tmux.conf" -S "/shared/github-copilot-auth.sock")
"${tmux_base[@]}" has-session -t github-copilot-auth 2>/dev/null || "${tmux_base[@]}" new-session -d -s github-copilot-auth -n GitHub-Copilot "cd /home/app/workspace && exec opencode auth login -p github-copilot"
exec ttyd --writable --interface 0.0.0.0 --port 7682 --base-path /copilot-auth \
  -t '\''fontFamily="JetBrainsMono Nerd Font Mono,Symbols Nerd Font Mono,monospace"'\'' \
  "${tmux_base[@]}" attach-session -t github-copilot-auth
'
