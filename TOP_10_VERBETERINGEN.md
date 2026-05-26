# Top 10 verbeteringen

1. **Security dependency update admin-app** — Fastify, Vite, TypeScript en verwante packages zijn bijgewerkt; `npm audit` is schoon.
2. **Ongebruikte `uuid` dependency verwijderd** — minder attack surface en kleinere install.
3. **Node engine aangescherpt** — admin vereist nu Node `>=20.19.0`, passend bij Vite 8.
4. **Build/typecheck hersteld na updates** — TypeScript 6-deprecation rond `baseUrl` is expliciet afgehandeld.
5. **Veiligere admin apply-default** — `OPENCODE_APPLY_RESTART` staat in compose standaard op `false`, consistent met de README en veiliger voor productie.
6. **Docker-sidecar iCloud Drive-mount toegevoegd** — `SSH 2631DE` kan `iCloud Drive / opencode-sync` via de `rclone/rclone` container mounten en via `compose.icloud-drive.override.yaml` zichtbaar maken in OpenCode, OpenChamber, code-server, WebDAV en read-only in opencode-admin.
7. **Runtime-dashboard voor opencode-admin toegevoegd** — nieuwe pagina `Sites & Runtime` controleert alle 2631DE websites, iCloud / Opencode-Sync zichtbaarheid, `icloud-rclone` health en TokenSpeed Monitor-installatie.
8. **Linting hersteld** — ESLint 9-config en dependencies zijn toegevoegd; `npm run lint` draait nu schoon.
9. **CI toevoegen** — voeg GitHub Actions toe voor `npm ci`, `npm audit`, `npm run lint`, `npm run typecheck` en `npm run build` bij elke push/PR.
10. **Generated/build artifacts opschonen** — overweeg getrackte build-output zoals `vite.config.js`/`.d.ts` te verwijderen of expliciet als bron te behandelen, zodat builds geen ruis in git-diffs veroorzaken.
