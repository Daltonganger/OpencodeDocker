# OpenCode Admin

Control plane voor de OpenCode-stack op `2631DE`.

## Wat het doet

- beheert alle 6 Pantheon agents
- beheert plugins, providers, MCP servers, OAuth metadata en secret status
- toont runtime-status voor alle 2631DE websites, iCloud Drive / Opencode-Sync en TokenSpeed Monitor
- rendert:
  - `config/generated/opencode.json`
  - `config/generated/oh-my-opencode-slim.jsonc`
- kan apply + rollback uitvoeren voor de target stack

## Stack

- frontend: React + Vite + TypeScript
- backend: Fastify + TypeScript
- runtime: file-based MVP control plane

## Bronbestanden

Onder `config/sources`:

- `routing.json`
- `plugins.json`
- `providers.json`
- `mcp.json`
- `oauth.json`
- `features.json`
- `secrets.refs.json`

## Generated output

Onder `config/generated`:

- `opencode.json`
- `oh-my-opencode-slim.jsonc`
- `release-metadata.json`

## Development

```bash
cp .env.example .env
npm install
npm run dev
```

- web: `http://localhost:3000`
- api: `http://localhost:3001`

## Build

```bash
npm run build
```

## Deploy op 2631DE

Plaats de app op:

- `/opt/stacks/opencode-admin`

Vul daarna `.env` in en deploy:

```bash
cp .env.example .env
chmod 600 .env
docker compose -f /opt/stacks/opencode-admin/compose.yaml up -d --build
```

## Domein

- `https://opencode.2631.eu/manage`

De site draait achter bestaande Traefik + Authelia.

## Sites & Runtime

De UI heeft een aparte pagina **Sites & Runtime**. Die leest via de Docker socket:

- status van `opencode.2631.eu`, `/manage`, `openchamber.2631.eu`, `code.2631.eu`, WebDAV, ntfy en SSH 2631DE
- status van de `icloud-rclone` sidecar en de gedeelde iCloud FUSE mount
- preview van `iCloud Drive / opencode-sync` via `/app/icloud` in de admin container
- TokenSpeed Monitor checks voor admin config, target `opencode.json`, image seed en gedeelde SSH backend
- iPad-snelkoppelingen voor ttyd/tmux, OpenChamber, code-server, Admin, WebDAV en native SSH apps

De admin container mount dezelfde iCloud hostmap read-only:

```env
OPENCODE_ICLOUD_HOST_PATH=/opt/stacks/opencode-dev/icloud-drive
OPENCODE_ICLOUD_REMOTE=icloud:opencode-sync
```

Houd deze waarden gelijk aan `generated/2631de/opencode-dev/.env`.

## Apply-flow

1. wijzig brondata in de UI
2. validate
3. bekijk diff
4. apply
5. optioneel restart van `opencode-dev`
6. rollback via release history indien nodig

## Secrets

De UI leest secret status uit de target `.env` van de OpenCode stack:

- standaard: `/opt/stacks/opencode-dev/.env`

Secretwaarden worden niet teruggelezen in plain text.

## Notes

- modelrouting zit in `routing.json`, niet in `.env`
- de target stack is standaard `/opt/stacks/opencode-dev`
- `OPENCODE_APPLY_RESTART=false` is de veilige default
- `opencode-tokenspeed-monitor@latest` staat standaard enabled in `config/sources/plugins.json` en wordt mee geseed in `Dockerfile.opencode`
- Kiro en Cursor staan standaard beschikbaar in de plugin-catalogus (`opencode-kiro-auth@latest`, `opencode-cursor-auth@latest`) plus de Opencode-Sync varianten (`@zhafron/opencode-kiro-auth`, `@rama_nigg/open-cursor@github:Nomadcxx/opencode-cursor#main`, `cursor-acp`). Ze staan bewust uit tot je ze in de Plugins-pagina aanzet, zodat auth/proxy-side effects niet onbedoeld starten.
- Extra Opencode-Sync plugins staan nu ook in de catalogus: Warp, OpenQwenCode, OpenCommand, CodexVision en de lokale Antigravity fork. Lokale plugins worden in de OpenCode Docker image onder `/opt/opencode-plugins` geplaatst.
- Codex is géén plugin: die staat als provider/modelgateway `Codex (codex.2631.eu)` in Providers en wijst naar `https://codex.2631.eu/v1`.
- iPad-runbook: `docs/IPAD_WERKPLEK.md`.
