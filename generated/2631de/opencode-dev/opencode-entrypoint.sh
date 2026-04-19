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

ensure_plugin_cache() {
  local cache_dir="/home/app/.cache/opencode"
  local seed_dir="/home/app/.cache/opencode-seed"
  local missing

  if [ ! -f "$cache_dir/package.json" ] && [ -f "$seed_dir/package.json" ]; then
    cp "$seed_dir/package.json" "$cache_dir/package.json"
    if [ -f "$seed_dir/bun.lock" ]; then
      cp "$seed_dir/bun.lock" "$cache_dir/bun.lock"
    fi
  fi

  missing="$(python3 - <<'PY'
import json
from pathlib import Path

config_path = Path('/home/app/.config/opencode/opencode.json')
cache_path = Path('/home/app/.cache/opencode/package.json')
plugins = []
deps = {}

if config_path.exists():
    plugins = json.loads(config_path.read_text()).get('plugin', [])
if cache_path.exists():
    deps = json.loads(cache_path.read_text()).get('dependencies', {})

def package_name(spec: str) -> str:
    if spec.startswith('@'):
        slash = spec.find('/')
        last_at = spec.rfind('@')
        return spec[:last_at] if last_at > slash else spec
    return spec.split('@', 1)[0]

print('\n'.join(spec for spec in plugins if package_name(spec) not in deps))
PY
)"

  if [ -n "$missing" ]; then
    mapfile -t missing_plugins <<< "$missing"
    gosu app bun add --cwd "$cache_dir" --exact "${missing_plugins[@]}"
  fi
}

ensure_plugin_cache

exec gosu app bash -lc '
exec ttyd --writable --interface 0.0.0.0 --port 7681 \
  -t '\''rendererType=canvas'\'' \
  -t '\''fontFamily="JetBrainsMono Nerd Font Mono,Symbols Nerd Font Mono,monospace"'\'' \
  /usr/local/bin/opencode-attach.sh
'
