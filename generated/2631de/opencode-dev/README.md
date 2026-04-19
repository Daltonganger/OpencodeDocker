# OpenCode Dev stack

Productiestack voor `SSH 2631DE` op `/opt/stacks/opencode-dev`.

## Domeinen

- `https://opencode.2631.eu` → ttyd / OpenCode
- `https://openchamber.2631.eu` → OpenChamber web UI
- `https://code.2631.eu` → code-server
- `https://opencode.2631.eu/files` → SFTPGo WebDAV (canoniek)
- `https://code.2631.eu/files` → SFTPGo WebDAV alias
- `ssh -p 2631 root@<server>` → zelfde tmux/OpenCode sessie

## Architectuur

```text
Traefik + Authelia
  ├─ opencode.2631.eu        -> opencode-dev:7681
  ├─ openchamber.2631.eu     -> openchamber:3000
  ├─ code.2631.eu            -> code-server:8080
  ├─ opencode.2631.eu/files  -> sftpgo:8090
  └─ code.2631.eu/files      -> sftpgo:8090

SSH :2631
  └─ ssh-dev -> /shared/tmux.sock -> dezelfde opencode tmux sessie

Interne backend
  └─ opencode-backend:4096 -> private gedeelde headless OpenCode server + eigenaar van de gedeelde tmux sessie
```

## Directory tree

```text
/opt/stacks/opencode-dev
├── compose.yaml
├── .env
├── Dockerfile.opencode
├── Dockerfile.ssh
├── ssh-entrypoint.sh
├── render-opencode-config.sh
├── auth-bootstrap.sh
├── config/
│   ├── opencode/
│   ├── ssh/
│   └── sftpgo/
├── state/
│   ├── opencode/
│   └── code-server/
├── cache/
│   └── opencode/
└── workspace/
```

## Quick start

1. Kopieer `.env.example` naar `.env`.
2. Vul API keys, OAuth credentials en WebDAV credentials in.
3. Plaats je public key in `config/ssh/authorized_keys`.
4. Run `bash render-opencode-config.sh`.
5. Run `docker compose config --quiet`.
6. Deploy via Dockge of `make up`.

## Eerste deploy op 2631DE

```bash
cp .env.example .env
chmod 600 .env
bash render-opencode-config.sh
docker compose config --quiet
docker compose up -d --build
```

## OAuth bootstrap

Na eerste deploy:

- open `https://opencode.2631.eu/manage`
- ga naar `OAuth`
- GitHub, Google en Qwen gebruiken de directe OpenCode runtime-login
- Qwen login draait via `https://opencode.2631.eu/qwen-auth/`

Qwen tokens worden persistent opgeslagen in `state/opencode/qwen`.

## OpenChamber

- OpenChamber draait op `https://openchamber.2631.eu`
- gebruikt dezelfde workspace, OpenCode config en auth/state als de hoofdstack
- proxyt server-side naar de gedeelde interne OpenCode backend op `opencode-backend:4096`
- werkt als rijke web/PWA-interface bovenop OpenCode
- zit achter Authelia

## code-server als beheerinterface

code-server installeert deze extensies nu automatisch bij start als ze nog ontbreken in de persistente state:

- OpenChamber
- Kilo Code
- PHP Intelephense
- GitHub Actions
- GitLens
- Prettier
- EditorConfig
- YAML
- PHP Debug

De extensies blijven bewaard onder:

- `state/code-server/extensions`

De OpenChamber extension in code-server praat via de extension host direct met de interne backend `http://opencode-backend:4096`.

De code-server image bevat dus geen lokale OpenCode/MCP runtime; alle MCP-processen draaien alleen op `opencode-backend`.

Bij een lege code-server state wordt ook standaard deze setting gezet:

- `openchamber.apiUrl = http://opencode-backend:4096`

Voor bestaande code-server user settings wordt deze waarde bij containerstart ook gezet/gesynchroniseerd zolang `state/code-server/User/settings.json` geldige JSON bevat.

De code-server runtime schrijft bij start ook expliciet `auth: none` naar `~/.config/code-server/config.yaml`; toegang loopt dus alleen via Authelia.

### code-server herstart op SSH 2631DE

Na wijzigingen aan `Dockerfile.code-server`, `code-server-entrypoint.sh` of de standaard settings:

```bash
ssh 2631DE
cd /opt/stacks/opencode-dev
docker compose up -d --build code-server
docker compose logs --tail=100 code-server
```

Dit rebuildt en herstart alleen `code-server` op de host `2631DE`.

Gebruik `code.2631.eu` om deze bestanden te beheren:

- `config/opencode/opencode.json.tmpl`
- `config/opencode/oh-my-opencode-slim.jsonc.tmpl`
- `config/opencode/opencode.json`
- `config/opencode/oh-my-opencode-slim.jsonc`
- `render-opencode-config.sh`

De configmap moet daarom schrijfbaar zijn voor UID/GID `1000:1000`.

## iPad/browser flow

1. Login via Authelia op `opencode.2631.eu`.
2. Werk in ttyd/OpenCode.
3. Open `code.2631.eu` voor visueel beheer.
4. Mount `https://opencode.2631.eu/files` als primaire WebDAV URL.

## iPad native SSH flow

```bash
ssh -p 2631 root@<server-ip>
```

Je landt direct in dezelfde tmux sessie als ttyd.

## WebDAV / Mountain Duck

- Canonieke URL: `https://opencode.2631.eu/files`
- Alias: `https://code.2631.eu/files`
- Auth: native SFTPGo credentials uit `.env`

## Update procedure

```bash
make backup-config
make render-config
make validate-config
docker compose pull
docker compose up -d --build
```
