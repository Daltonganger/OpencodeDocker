# iPad werkplek voor OpenCode op 2631DE

Doel: vanaf een iPad altijd in dezelfde OpenCode-runtime kunnen werken, zonder lokale setup op de iPad.

## Snelste route: Safari / PWA

1. Open `https://opencode.2631.eu` en log in via Authelia.
2. Voeg de pagina toe aan het beginscherm als PWA/webclip.
3. Je komt in `ttyd`, direct gekoppeld aan dezelfde `tmux` sessie als SSH.
4. Open daarnaast `https://openchamber.2631.eu` als tweede webclip voor de rijke OpenChamber UI.
5. Gebruik `https://code.2631.eu` wanneer je bestanden visueel wilt bewerken.

Aanbevolen iPad webclips:

| Naam | URL | Gebruik |
|---|---|---|
| OpenCode Tmux | `https://opencode.2631.eu` | terminal/tmux sessie |
| OpenChamber | `https://openchamber.2631.eu` | OpenCode web/app interface |
| Code | `https://code.2631.eu` | editor + bestanden |
| Admin | `https://opencode.2631.eu/manage` | plugins/providers/runtime status |
| Files | `https://opencode.2631.eu/files` | WebDAV/SFTPGo bestanden |

## Native SSH route

Gebruik een iPad SSH-app zoals Blink Shell, Termius of Prompt:

```bash
ssh -p 2631 root@2631DE
```

De SSH-container gebruikt `ForceCommand` en attach direct op `/shared/tmux.sock`. Daardoor zie je dezelfde sessie als in `ttyd` op `opencode.2631.eu`.

## Bestanden op iPad

Gebruik WebDAV in een app zoals Documents, FE File Explorer, Secure ShellFish of Working Copy:

```text
https://opencode.2631.eu/files
```

De WebDAV-map deelt dezelfde workspace en de iCloud/Opencode-Sync mount (`workspace/icloud`) met OpenCode, OpenChamber en code-server.

## iPad checklist

- Authelia werkt in Safari en onthoudt de sessie.
- SSH public key staat in `/opt/stacks/opencode-dev/config/ssh/authorized_keys`.
- `ssh-dev` draait en publiceert poort `2631`.
- `opencode-dev` en `opencode-backend` zijn healthy.
- OpenChamber wijst naar `opencode-backend:4096`.
- WebDAV credentials staan in `.env` en SFTPGo draait.
- Voor iCloud/Opencode-Sync: `make up-icloud` en daarna `make icloud-test` op 2631DE.

## Runtime controle

Open `https://opencode.2631.eu/manage` → **Sites & Runtime**. Daar staan de iPad-routes, containerstatussen, iCloud/Opencode-Sync preview en TokenSpeed checks bij elkaar.
