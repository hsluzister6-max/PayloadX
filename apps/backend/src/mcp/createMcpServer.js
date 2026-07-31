import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPayloadXTools } from './registerTools.js';

/**
 * Create a fresh PayloadX MCP server instance for one session/request.
 */
export function createPayloadXMcpServer(user) {
  const server = new McpServer(
    {
      name: 'payloadx',
      version: '1.0.0',
    },
    {
      instructions:
        'PayloadX MCP — create and manage API requests, collections, folders, and environments in the user’s PayloadX workspace. Prefer list_teams → list_projects → list_collections before create_request so IDs are valid.',
    }
  );

  registerPayloadXTools(server, user);
  return server;
}
