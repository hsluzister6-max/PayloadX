# PayloadX MCP Server

Free MCP for Cursor / Claude. Create APIs that appear in PayloadX.

## Get a token (in the app)

1. Sign in to **PayloadX** desktop  
2. Click your **avatar** (bottom-left) → **MCP / API Tokens**  
3. Click **Generate token**  
4. Click a token → **Copy config**

No local repo path. No Mongo URI. No JWT secret.

## Cursor config (any machine)

Paste into `~/.cursor/mcp.json` (or project `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "payloadx": {
      "url": "https://YOUR_CLOUD_RUN_URL/mcp",
      "headers": {
        "Authorization": "Bearer pxat_..."
      }
    }
  }
}
```

This uses **Streamable HTTP** against your PayloadX backend. Other users only need:

1. Their own `pxat_…` token (from Account → MCP Tokens)  
2. The same `/mcp` URL (your deployed API)

They do **not** need your Mac path or a local clone of this repo.

### Local backend (optional)

If the API runs on your machine:

```json
{
  "mcpServers": {
    "payloadx": {
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer pxat_..."
      }
    }
  }
}
```

### Dev-only: stdio (requires this repo checked out)

```bash
PAYLOADX_TOKEN=pxat_... PAYLOADX_BASE_URL=http://localhost:3001 npm run mcp -w apps/backend
```

```json
{
  "mcpServers": {
    "payloadx": {
      "command": "node",
      "args": ["apps/backend/src/mcp/stdio.js"],
      "env": {
        "PAYLOADX_TOKEN": "pxat_...",
        "PAYLOADX_BASE_URL": "http://localhost:3001"
      }
    }
  }
}
```

Prefer the `url` config for sharing.

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/api-tokens` | Create token |
| GET | `/api/auth/api-tokens` | List tokens |
| GET | `/api/auth/api-tokens/:id` | Reveal token + MCP config |
| DELETE | `/api/auth/api-tokens/:id` | Revoke |
| POST | `/mcp` | MCP Streamable HTTP |

Tokens look like `pxat_…` and work anywhere Bearer auth is accepted (REST + MCP).

## Tools

**Workspace:** `whoami`, `list_teams`, `create_team`, `list_projects`, `create_project`, `list_collections`, `list_requests`, `search_requests`, `get_request`, `create_collection`, `create_folder`, `create_request`, `update_request`, `delete_request`, `list_environments`, `create_environment`

**Workflows:** `list_workflows`, `get_workflow`, `create_workflow`, `update_workflow`, `delete_workflow`, `build_workflow_from_requests`, `set_workflow_order`, `add_workflow_api_node`, `list_workflow_executions`

Typical API flow: `create_team` → `create_project` → `create_collection` → `create_folder` → `create_request`.

Typical workflow flow:

1. `list_requests` / `search_requests` — pick API ids  
2. `build_workflow_from_requests` — create workflow with those APIs in order  
3. `add_workflow_api_node` / `set_workflow_order` / `update_workflow` — edit graph  
4. `get_workflow` — inspect nodes + edges
