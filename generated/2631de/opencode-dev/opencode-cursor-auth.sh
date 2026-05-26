set -euo pipefail

mkdir -p \
  /shared \
  /home/app/workspace \
  /home/app/.config/opencode \
  /home/app/.cursor \
  /home/app/.qwen \
  /home/app/.local/share/opencode \
  /home/app/.local/state/opencode \
  /home/app/.cache/opencode
chown -R app:app \
  /shared \
  /home/app/workspace \
  /home/app/.config/opencode \
  /home/app/.cursor \
  /home/app/.qwen \
  /home/app/.local/share/opencode \
  /home/app/.local/state/opencode \
  /home/app/.cache/opencode

cat > /tmp/opencode-cursor-auth-session.sh <<'EOF'
set -euo pipefail

mkdir -p /home/app/.cursor /home/app/.config/opencode /home/app/.local/share/opencode

if ! command -v cursor-agent >/dev/null 2>&1; then
  curl -fsSL https://cursor.com/install | bash
fi

cd /home/app/workspace
echo 'Cursor auth helper'
echo 'Log in met cursor-agent. De open-cursor plugin exposeert daarna cursor-acp op 127.0.0.1:32124.'
echo
cursor-agent login || true
echo
echo 'Cursor login klaar of geannuleerd. Je kunt dit venster sluiten of opnieuw proberen met: cursor-agent login'
exec bash -l
EOF
chmod +x /tmp/opencode-cursor-auth-session.sh

exec gosu app bash -lc '
tmux_base=(tmux -f "/home/app/.config/opencode/tmux.conf" -S "/shared/cursor-auth.sock")
"${tmux_base[@]}" has-session -t cursor-auth 2>/dev/null || "${tmux_base[@]}" new-session -d -s cursor-auth -n Cursor-Auth "/tmp/opencode-cursor-auth-session.sh"
exec ttyd --writable --interface 0.0.0.0 --port 7686 --base-path /cursor-auth \
  -t '\''fontFamily="JetBrainsMono Nerd Font Mono,Symbols Nerd Font Mono,monospace"'\'' \
  "${tmux_base[@]}" attach-session -t cursor-auth
'
