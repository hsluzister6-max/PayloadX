# PayloadX MCP Server

Free MCP for Cursor / Claude. Create APIs that appear in PayloadX.

## Get a token (in the app)

1. Sign in to **PayloadX** desktop  
2. Click your **avatar** (bottom-left) → **MCP / API Tokens**  
3. Click **Generate token**  
4. Click **Copy config** (or copy the token)

No Mongo URI. No JWT secret.

## Cursor config

```json
{
  "mcpServers": {
    "payloadx": {
      "command": "node",
      "args": [
        "/Volumes/PSQUARE SSD/PayloadX/apps/backend/src/mcp/stdio.js"
      ],
      "env": {
        "PAYLOADX_TOKEN": "pxat_..."
      }
    }
  }
}
```

Optional local backend:

```json
"PAYLOADX_BASE_URL": "http://localhost:3001"
```

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/api-tokens` | Create token (returns raw once) |
| GET | `/api/auth/api-tokens` | List tokens |
| DELETE | `/api/auth/api-tokens/:id` | Revoke |
| POST | `/mcp` | MCP Streamable HTTP |

Tokens look like `pxat_…` and work anywhere Bearer auth is accepted (REST + MCP).

## Tools

`whoami`, `list_teams`, `list_projects`, `list_collections`, `list_requests`, `search_requests`, `get_request`, `create_collection`, `create_folder`, `create_request`, `update_request`, `delete_request`, `list_environments`, `create_environment`
