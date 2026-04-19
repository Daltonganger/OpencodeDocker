# OpenCode Admin API

Fastify + TypeScript backend for OpenCode Admin MVP.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Start

```bash
npm start
```

## Environment Variables

- `PORT` - Server port (default: 3001)
- `HOST` - Server host (default: 0.0.0.0)
- `OPENCODE_SOURCES_DIR` - Override sources directory
- `OPENCODE_GENERATED_DIR` - Override generated directory

## API Endpoints

### Health
- `GET /health` - Health check

### Resources (under /api/v1)
- `GET /api/v1/agents` - List all agents
- `GET /api/v1/agents/:type` - Get specific agent
- `PUT /api/v1/agents/:type` - Update agent

- `GET /api/v1/plugins` - List all plugins
- `POST /api/v1/plugins` - Create/update plugin
- `GET /api/v1/plugins/:name` - Get specific plugin

- `GET /api/v1/providers` - List all providers (no secrets)
- `POST /api/v1/providers` - Create/update provider
- `GET /api/v1/providers/:name` - Get specific provider

- `GET /api/v1/mcp` - List all MCP servers
- `POST /api/v1/mcp` - Create/update MCP server
- `GET /api/v1/mcp/:name` - Get specific MCP server

### Status Metadata (no secrets)
- `GET /api/v1/oauth` - List OAuth statuses
- `GET /api/v1/oauth/:provider` - Get OAuth status for provider

- `GET /api/v1/secrets` - List secrets statuses
- `GET /api/v1/secrets/:key` - Get secret status

### Dashboard
- `GET /api/v1/dashboard` - Get dashboard summary

### Operations
- `POST /api/v1/validate` - Validate all sources
- `POST /api/v1/validate/:resource` - Validate specific resource

- `GET /api/v1/diff` - Diff current vs generated
- `GET /api/v1/diff/:file` - Diff specific file

- `POST /api/v1/apply` - Apply changes (with optional dryRun)

- `POST /api/v1/rollback/last` - Rollback to previous release
- `POST /api/v1/rollback/:releaseId` - Rollback to specific release

- `GET /api/v1/releases` - List all releases
- `GET /api/v1/releases/:releaseId` - Get specific release
- `GET /api/v1/releases/:releaseId/files/:filename` - Get release file content
