#!/usr/bin/env bash
set -euo pipefail

tmux_base=(tmux -f "/home/app/.config/opencode/tmux.conf" -S "/shared/tmux.sock")
socket_error_file="/tmp/opencode-tmux-error.log"

reset_socket_if_needed() {
  if [ -f "$socket_error_file" ] && grep -qi 'permission denied' "$socket_error_file"; then
    rm -f /shared/tmux.sock
  fi
}

if ! "${tmux_base[@]}" has-session -t opencode 2>"$socket_error_file"; then
  reset_socket_if_needed
  "${tmux_base[@]}" new-session -d -s opencode -n OpenCode "/usr/local/bin/opencode-session.sh"
fi

if ! "${tmux_base[@]}" attach-session -t opencode 2>"$socket_error_file"; then
  reset_socket_if_needed
  "${tmux_base[@]}" new-session -d -s opencode -n OpenCode "/usr/local/bin/opencode-session.sh"
  exec "${tmux_base[@]}" attach-session -t opencode
fi
