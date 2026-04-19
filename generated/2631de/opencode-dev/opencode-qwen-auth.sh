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
tmux_base=(tmux -f "/home/app/.config/opencode/tmux.conf" -S "/shared/qwen-auth.sock")
"${tmux_base[@]}" has-session -t qwen-auth 2>/dev/null || "${tmux_base[@]}" new-session -d -s qwen-auth -n Qwen-Auth "cd /home/app/workspace && exec opencode auth login -p qwen-code"
exec ttyd --writable --interface 0.0.0.0 --port 7684 --base-path /qwen-auth \
  -t '\''fontFamily="JetBrainsMono Nerd Font Mono,Symbols Nerd Font Mono,monospace"'\'' \
  "${tmux_base[@]}" attach-session -t qwen-auth
'
