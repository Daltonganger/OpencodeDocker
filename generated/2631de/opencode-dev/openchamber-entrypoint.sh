#!/usr/bin/env sh
set -eu

HOME="/home/openchamber"
OPENCODE_CONFIG_DIR="${OPENCODE_CONFIG_DIR:-${HOME}/.config/opencode}"
export OPENCODE_CONFIG_DIR

SSH_DIR="${HOME}/.ssh"
SSH_PRIVATE_KEY_PATH="${SSH_DIR}/id_ed25519"
SSH_PUBLIC_KEY_PATH="${SSH_PRIVATE_KEY_PATH}.pub"

mkdir -p "${SSH_DIR}" "${HOME}/workspaces" "${HOME}/.config/openchamber" "${HOME}/.local/share/opencode" "${HOME}/.local/state/opencode"

if [ ! -f "${SSH_PRIVATE_KEY_PATH}" ] || [ ! -f "${SSH_PUBLIC_KEY_PATH}" ]; then
  ssh-keygen -t ed25519 -N "" -f "${SSH_PRIVATE_KEY_PATH}" >/dev/null
fi

chmod 700 "${SSH_DIR}" 2>/dev/null || true
chmod 600 "${SSH_PRIVATE_KEY_PATH}" 2>/dev/null || true
chmod 644 "${SSH_PUBLIC_KEY_PATH}" 2>/dev/null || true

python3 <<'PY'
import json
from pathlib import Path

settings_path = Path('/home/openchamber/.config/openchamber/settings.json')
settings = {}
if settings_path.exists():
    try:
        settings = json.loads(settings_path.read_text())
    except Exception:
        settings = {}

providers = settings.get('usageDropdownProviders') or []
wanted = [
    'codex',
    'github-copilot',
    'google',
    'kilo',
    'kimi-for-coding',
    'nano-gpt',
    'openrouter',
    'minimax-cn-coding-plan',
    'minimax-coding-plan',
    'ollama-cloud',
    'zai-coding-plan',
]
merged = []
for item in [*providers, *wanted]:
    if item not in merged:
        merged.append(item)
settings['usageDropdownProviders'] = merged
settings_path.parent.mkdir(parents=True, exist_ok=True)
settings_path.write_text(json.dumps(settings, indent=2) + '\n')
PY

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

set -- openchamber --port 3000
if [ -n "${OPENCHAMBER_UI_PASSWORD:-}" ]; then
  set -- "$@" --ui-password "$OPENCHAMBER_UI_PASSWORD"
fi

"$@"
exec openchamber logs -p 3000
