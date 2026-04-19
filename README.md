# 2631DE OpenCode Stack

This repository contains the source files, generated stack files, and admin/control-plane code for the self-hosted OpenCode environment running on **2631DE**.

## Overview

The platform runs a **single shared OpenCode backend** (`opencode-backend:4096`). All three frontends attach to that one runtime — they share config, auth state, workspace, sessions, and MCP servers.

| Frontend | URL | How it connects |
|---|---|---|
| tmux / ttyd | `https://opencode.2631.eu` | ttyd attached to shared tmux session |
| SSH | `ssh 2631DE` (port 2631) | attach to same tmux session |
| OpenChamber | `https://openchamber.2631.eu` | `OPENCODE_SKIP_START=true` → backend |
| OpenChamber extension | inside `https://code.2631.eu` | `openchamber.apiUrl` → `http://opencode-backend:4096` |

## Architecture

### Single backend model

```
opencode-backend (4096)
  ├── opencode serve (headless API)
  ├── tmux session "opencode" (shared with ttyd + SSH)
  ├── MCP servers (spawned here, nowhere else)
  │     ├── context7        /usr/local/bin/context7-mcp
  │     ├── tavily          /usr/local/bin/tavily-mcp
  │     ├── brave-search    /usr/local/bin/mcp-server-brave-search
  │     ├── chrome-devtools /usr/local/bin/chrome-devtools-mcp
  │     ├── playwright      /usr/local/bin/playwright-mcp
  │     └── browser         /usr/local/bin/playwright-mcp (vision+pdf+devtools)
  └── Chromium wrapper      /usr/local/bin/opencode-browser

opencode-dev (7681)      → ttyd wrapping the tmux session
openchamber (3000)       → OpenChamber web UI (OPENCODE_SKIP_START=true)
code-server (8080)       → VS Code in browser; OpenChamber extension → backend
ssh-dev (2631)           → SSH attach to tmux session
```

MCP binaries live **only** in `Dockerfile.opencode`. `Dockerfile.code-server` intentionally has none — the extension delegates everything to the backend.

### Internal backend route

There is no public OpenCode API route. The OpenChamber extension in code-server reaches the backend directly over the internal Docker network at `http://opencode-backend:4096`.

### OAuth routes

- GitHub Copilot: `https://opencode.2631.eu/copilot-auth/`
- Google / Antigravity: `https://opencode.2631.eu/google-auth/`
- Qwen: `https://opencode.2631.eu/qwen-auth/`

GitHub, Google, and Qwen use OpenCode runtime login.

## Public URLs

- `https://opencode.2631.eu` — OpenCode terminal (ttyd), behind Authelia
- `https://opencode.2631.eu/manage` — OpenCode Admin, behind Authelia
- `https://openchamber.2631.eu` — OpenChamber, behind Authelia
- `https://code.2631.eu` — code-server, behind Authelia
- `https://notify.2631.eu` — ntfy, behind Authelia
- `https://opencode.2631.eu/files` — WebDAV
- `https://code.2631.eu/files` — WebDAV alias

## SSH access

```bash
ssh 2631DE
```

`~/.ssh/config` alias uses:
- `HostName 5.249.161.128`
- `User root`
- `Port 2222`
- `IdentityFile ~/.ssh/id_ed25519_MacM4`

## Repository structure

- `generated/2631de/opencode-dev/` — main stack files
- `generated/2631de/ntfy/` — ntfy stack files
- `opencode-admin/` — admin / control plane

## Auto-update

The auto-updater syncs the admin stack and the generated main stack, then rebuilds and restarts the relevant services. OpenChamber is included in that update flow together with the rest of the main stack.

## Example `.env` values

```env
# --- Required core providers ---
OPENAI_API_KEY=PASTE_HERE
OPENROUTER_API_KEY=PASTE_HERE
CODEXLB_API_KEY=PASTE_HERE
CHAT2631_API_KEY=PASTE_HERE

# --- Required MCP / search ---
TAVILY_API_KEY=PASTE_HERE
BRAVE_API_KEY=PASTE_HERE
CONTEXT7_API_KEY=PASTE_HERE

# --- Optional extra providers ---
NANOGPT_API_KEY=PASTE_HERE
NVIDIA_API_KEY=PASTE_HERE
KILO_GATEWAY_API_KEY=PASTE_HERE
ZAI_API_KEY=PASTE_HERE

# --- WebDAV ---
SFTPGO_WEBDAV_USERNAME=webdav
SFTPGO_WEBDAV_PASSWORD=PASTE_HERE

# --- Runtime basics ---
PUID=1000
PGID=1000
UMASK=002
TZ=Europe/Amsterdam

# --- Model routing ---
OPENCODE_MODEL=google/antigravity-gemini-3-pro
OPENCODE_SMALL_MODEL=codexlb/gpt-4o-mini
PRIMARY_REASONING_MODEL=google/antigravity-gemini-3-pro
FAST_CODER_MODEL=codexlb/gpt-4o-mini
RESEARCH_MODEL=openrouter/openai/gpt-4o-mini
BUDGET_MODEL=openrouter/openai/gpt-4o-mini
```

## Current status

- Single backend model fully active: tmux, OpenChamber, and code-server extension all share `opencode-backend:4096`
- MCP servers run exclusively in the backend container
- No public OpenCode API route; internal routing only
- `Dockerfile.code-server` is lean: no Node, no Chromium, no MCP packages
- WhisperCode has been removed
- Admin validation is clean