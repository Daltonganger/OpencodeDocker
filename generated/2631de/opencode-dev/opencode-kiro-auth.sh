set -euo pipefail

mkdir -p \
  /shared \
  /home/app/workspace \
  /home/app/.config/opencode \
  /home/app/.qwen \
  /home/app/.local/share/kiro-cli \
  /home/app/.local/share/opencode \
  /home/app/.local/state/opencode \
  /home/app/.cache/opencode
chown -R app:app \
  /shared \
  /home/app/workspace \
  /home/app/.config/opencode \
  /home/app/.qwen \
  /home/app/.local/share/kiro-cli \
  /home/app/.local/share/opencode \
  /home/app/.local/state/opencode \
  /home/app/.cache/opencode

cat > /tmp/opencode-kiro-auth-session.sh <<'EOF'
set -euo pipefail

mkdir -p /home/app/.config/opencode /home/app/.local/share/opencode /home/app/.local/share/kiro-cli

python3 - <<'PY'
import json
from pathlib import Path

auth_path = Path('/home/app/.local/share/opencode/auth.json')
auth_path.parent.mkdir(parents=True, exist_ok=True)
try:
    auth = json.loads(auth_path.read_text())
except Exception:
    auth = {}
auth.setdefault('kiro', {'type': 'api', 'key': 'placeholder'})
auth_path.write_text(json.dumps(auth, indent=2) + '\n')

config_path = Path('/home/app/.config/opencode/kiro.json')
config_path.parent.mkdir(parents=True, exist_ok=True)
try:
    config = json.loads(config_path.read_text())
except Exception:
    config = {}
config.setdefault('auto_sync_kiro_cli', True)
config.setdefault('account_selection_strategy', 'lowest-usage')
config.setdefault('default_region', 'us-east-1')
config_path.write_text(json.dumps(config, indent=2) + '\n')
PY

if ! command -v kiro-cli >/dev/null 2>&1; then
  curl -fsSL https://cli.kiro.dev/install | bash
fi

cd /home/app/workspace
echo 'Kiro auth helper'
echo 'Log in met kiro-cli; @zhafron/opencode-kiro-auth synchroniseert daarna naar OpenCode.'
echo
kiro-cli whoami || kiro-cli login || true
echo
echo 'Kiro login klaar of geannuleerd. Je kunt dit venster sluiten of opnieuw proberen met: kiro-cli login'
exec bash -l
EOF
chmod +x /tmp/opencode-kiro-auth-session.sh

exec gosu app bash -lc '
tmux_base=(tmux -f "/home/app/.config/opencode/tmux.conf" -S "/shared/kiro-auth.sock")
"${tmux_base[@]}" has-session -t kiro-auth 2>/dev/null || "${tmux_base[@]}" new-session -d -s kiro-auth -n Kiro-Auth "/tmp/opencode-kiro-auth-session.sh"
exec ttyd --writable --interface 0.0.0.0 --port 7685 --base-path /kiro-auth \
  -t '\''fontFamily="JetBrainsMono Nerd Font Mono,Symbols Nerd Font Mono,monospace"'\'' \
  "${tmux_base[@]}" attach-session -t kiro-auth
'
