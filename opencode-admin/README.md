# OpenCode Admin

Control plane voor de OpenCode-stack op `2631DE`.

## Wat het doet

- beheert alle 6 Pantheon agents
- beheert plugins, providers, MCP servers, OAuth metadata en secret status
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
