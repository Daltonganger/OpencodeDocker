#!/usr/bin/env bash
set -euo pipefail

STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${STACK_DIR}/.env"

cd "${STACK_DIR}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

export OPENCODE_MODEL="${OPENCODE_MODEL:-codexlb/gpt-5.4}"
export OPENCODE_SMALL_MODEL="${OPENCODE_SMALL_MODEL:-nanogpt/zai-org/glm-5:thinking}"
export PRIMARY_REASONING_MODEL="${PRIMARY_REASONING_MODEL:-$OPENCODE_MODEL}"
export FAST_CODER_MODEL="${FAST_CODER_MODEL:-$OPENCODE_SMALL_MODEL}"
export RESEARCH_MODEL="${RESEARCH_MODEL:-openrouter/openai/gpt-4o-mini}"
export BUDGET_MODEL="${BUDGET_MODEL:-openrouter/openai/gpt-4o-mini}"
export OPENROUTER_BASE_URL="${OPENROUTER_BASE_URL:-https://openrouter.ai/api/v1}"
export NANOGPT_BASE_URL="${NANOGPT_BASE_URL:-https://nanoproxy.2631.eu/v1}"
export NVIDIA_BASE_URL="${NVIDIA_BASE_URL:-https://integrate.api.nvidia.com/v1}"
export KILO_GATEWAY_BASE_URL="${KILO_GATEWAY_BASE_URL:-https://api.kilo.ai/api/gateway}"
export CHAT2631_BASE_URL="${CHAT2631_BASE_URL:-https://chat.2631.eu/v1}"
export CODEXLB_BASE_URL="${CODEXLB_BASE_URL:-https://codex.2631.eu/v1}"
export ZAI_BASE_URL="${ZAI_BASE_URL:-https://api.z.ai/api/coding/paas/v4}"
export QWEN_BASE_URL="${QWEN_BASE_URL:-https://dashscope.aliyuncs.com/compatible-mode/v1}"
export SFTPGO_WEBDAV_USERNAME="${SFTPGO_WEBDAV_USERNAME:-webdav}"
: "${SFTPGO_WEBDAV_PASSWORD:?SFTPGO_WEBDAV_PASSWORD must be set in .env}"

mkdir -p \
  "${STACK_DIR}/config/opencode" \
  "${STACK_DIR}/state/opencode/qwen" \
  "${STACK_DIR}/state/opencode/share" \
  "${STACK_DIR}/state/opencode/state" \
  "${STACK_DIR}/state/sftpgo" \
  "${STACK_DIR}/state/code-server" \
  "${STACK_DIR}/cache/opencode" \
  "${STACK_DIR}/workspace"

chown 1000:1000 "${STACK_DIR}/state/sftpgo"
chmod 775 "${STACK_DIR}/state/sftpgo"

python3 - <<'PY'
import os
from pathlib import Path

mapping = {
    "__OPENCODE_MODEL__": os.environ["OPENCODE_MODEL"],
    "__OPENCODE_SMALL_MODEL__": os.environ["OPENCODE_SMALL_MODEL"],
    "__PRIMARY_REASONING_MODEL__": os.environ["PRIMARY_REASONING_MODEL"],
    "__FAST_CODER_MODEL__": os.environ["FAST_CODER_MODEL"],
    "__RESEARCH_MODEL__": os.environ["RESEARCH_MODEL"],
    "__BUDGET_MODEL__": os.environ["BUDGET_MODEL"],
    "__OPENROUTER_BASE_URL__": os.environ["OPENROUTER_BASE_URL"],
    "__NANOGPT_BASE_URL__": os.environ["NANOGPT_BASE_URL"],
    "__NVIDIA_BASE_URL__": os.environ["NVIDIA_BASE_URL"],
    "__KILO_GATEWAY_BASE_URL__": os.environ["KILO_GATEWAY_BASE_URL"],
    "__CHAT2631_BASE_URL__": os.environ["CHAT2631_BASE_URL"],
    "__CODEXLB_BASE_URL__": os.environ["CODEXLB_BASE_URL"],
    "__ZAI_BASE_URL__": os.environ["ZAI_BASE_URL"],
    "__QWEN_BASE_URL__": os.environ["QWEN_BASE_URL"],
}

base = Path.cwd()
for src_name, dst_name in [
    ("config/opencode/opencode.json.tmpl", "config/opencode/opencode.json"),
    ("config/opencode/oh-my-opencode-slim.jsonc.tmpl", "config/opencode/oh-my-opencode-slim.jsonc"),
]:
    src = base / src_name
    dst = base / dst_name
    text = src.read_text()
    for key, value in mapping.items():
        text = text.replace(key, value)
    dst.write_text(text)
PY

cat > "${STACK_DIR}/state/sftpgo/initial_data.json" <<EOF
{
  "users": [
    {
      "username": "${SFTPGO_WEBDAV_USERNAME}",
      "password": "${SFTPGO_WEBDAV_PASSWORD}",
      "status": 1,
      "home_dir": "/srv/sftpgo/data/workspace",
      "permissions": {
        "/": ["*"]
      },
      "filesystem": {
        "provider": 0,
        "osfs_config": {
          "base_dir": "/srv/sftpgo/data/workspace"
        }
      }
    }
  ],
  "folders": [],
  "groups": []
}
EOF

chown 1000:1000 "${STACK_DIR}/state/sftpgo/initial_data.json"
chmod 600 "${STACK_DIR}/state/sftpgo/initial_data.json"

echo "Rendered:"
echo "- ${STACK_DIR}/config/opencode/opencode.json"
echo "- ${STACK_DIR}/config/opencode/oh-my-opencode-slim.jsonc"
echo "- ${STACK_DIR}/state/sftpgo/initial_data.json"
