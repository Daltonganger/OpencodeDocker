# MCP tips voor 2631DE / OpenCode

## Aanbevolen top-10 MCP set

1. **Filesystem MCP**  
   Direct nuttig voor `/files`, WebDAV, assets en config-checks.

2. **Docker MCP**  
   Handig voor logs, health, inspect en restarts in de multi-container setup.

3. **Chrome DevTools MCP**  
   Belangrijk voor UI-, PWA-, netwerk- en console-debugging.

4. **Playwright MCP**  
   Goed voor regressietests, screenshots en end-to-end validatie.

5. **GitHub MCP**  
   Voor issues, PR’s, releases en repo-automatisering.

6. **HTTP / Fetch MCP**  
   Nuttig voor healthchecks, interne routes, headers, manifest- en favicon-validatie.

7. **Postgres / SQLite MCP**  
   Handig als admin/API state of telemetry in een database opslaat.

8. **Traefik / Nginx / Reverse-proxy MCP**  
   Voor subdomeinen, TLS, caching, mime-types en routingproblemen.

9. **Sentry / logging MCP**  
   Voor snelle foutanalyse van frontend en backend.

10. **Grafana / Prometheus MCP**  
    Voor uptime, resourcegebruik en monitoring over tijd.

## Beste volgorde voor deze stack

Voor de huidige 2631DE/OpenCode-architectuur zou ik eerst deze toevoegen of activeren:

1. **Filesystem MCP**
2. **Docker MCP**
3. **HTTP / Fetch MCP**
4. **Reverse-proxy MCP**
5. **Logging MCP**

## Wat er nu al in de repo zit

Actieve MCP’s in de stack:

- `context7`
- `tavily`
- `brave-search`
- `chrome-devtools`
- `playwright`
- `browser`

Belangrijke config-paden:

- `opencode-admin/config/sources/mcp.json`
- `opencode-admin/config/sources/mcp/filesystem.json`
- `generated/2631de/opencode-dev/Dockerfile.opencode`
- `generated/2631de/opencode-dev/config/opencode/opencode.json.tmpl`
- `opencode-admin/apps/api/src/routes/mcp.ts`

## Opvallende kansen

- **Filesystem MCP** lijkt al deels voorbereid, maar staat nu niet actief.
- `@browsermcp/mcp` lijkt **wel geïnstalleerd maar niet geconfigureerd**.

## Praktisch advies

### Nu activeren

- Filesystem MCP
- Browser-validatie via DevTools + Playwright goed benutten
- HTTP/Fetch MCP toevoegen voor health- en routechecks

### Later toevoegen

- Docker MCP
- Reverse-proxy MCP
- Logging/Sentry MCP
- Grafana/Prometheus MCP
- GitHub MCP

## Waarom dit goed past bij 2631DE

De stack draait op een gedeelde OpenCode-backend met meerdere frontends, Docker-routing, WebDAV en beheer via `opencode-admin`. Daardoor leveren vooral MCP’s voor **files**, **containers**, **HTTP/proxy-debugging** en **monitoring** de meeste directe waarde op.
