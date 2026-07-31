#!/usr/bin/env node
/**
 * PayloadX MCP over stdio — for Cursor / Claude Desktop.
 *
 * Only needs an API token from PayloadX (avatar → MCP / API Tokens):
 *
 *   PAYLOADX_TOKEN    = pxat_… (from in-app Generate token)
 *   PAYLOADX_BASE_URL = optional, defaults to cloud backend
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createApiClient, DEFAULT_BASE } from './apiClient.js';
import { registerPayloadXToolsViaApi } from './registerToolsViaApi.js';

async function main() {
  const token = process.env.PAYLOADX_TOKEN || process.env.PAYLOADX_JWT;
  const baseUrl = process.env.PAYLOADX_BASE_URL || process.env.PAYLOADX_SERVER_URL || DEFAULT_BASE;

  if (!token) {
    console.error('[payloadx-mcp] Set PAYLOADX_TOKEN to your PayloadX login JWT.');
    console.error('[payloadx-mcp] Desktop → DevTools → Application → Local Storage → payloadx_token');
    process.exit(1);
  }

  const api = createApiClient({ baseUrl, token });

  // Quick auth check so Cursor shows a clear failure if token is bad
  try {
    await api.get('/api/team');
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.error || err.message;
    console.error(`[payloadx-mcp] Auth/API check failed (${status || 'network'}): ${msg}`);
    console.error(`[payloadx-mcp] Base URL: ${api.baseUrl}`);
    process.exit(1);
  }

  const server = new McpServer(
    { name: 'payloadx', version: '1.0.0' },
    {
      instructions:
        'PayloadX MCP (API mode). Use list_teams → list_projects → list_collections before create_request.',
    }
  );
  registerPayloadXToolsViaApi(server, api);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async () => {
    try {
      await server.close();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[payloadx-mcp]', err);
  process.exit(1);
});
