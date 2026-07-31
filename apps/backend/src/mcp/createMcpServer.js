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
        'PayloadX MCP — manage API requests, collections, folders, environments, and workflows. Prefer list_teams → list_projects → list_collections before create_request. For workflows use build_workflow_from_requests (ordered requestIds), or create_workflow/update_workflow with nodes+edges; set_workflow_order / add_workflow_api_node to edit ordering.',
    }
  );

  registerPayloadXTools(server, user);
  return server;
}
