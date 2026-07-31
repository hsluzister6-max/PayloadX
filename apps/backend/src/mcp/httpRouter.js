import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { resolveAuthToken } from '../middleware/auth.js';
import { createPayloadXMcpServer } from './createMcpServer.js';

const router = express.Router();

async function getBearerUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return resolveAuthToken(authHeader.slice(7));
}

function unauthorized(res) {
  res.status(401).json({
    jsonrpc: '2.0',
    error: {
      code: -32001,
      message: 'Unauthorized. Send Authorization: Bearer <pxat_… token or login JWT>.',
    },
    id: null,
  });
}

/**
 * GET /mcp — discovery / health for humans & clients
 */
router.get('/', async (req, res) => {
  const user = await getBearerUser(req);
  res.json({
    name: 'payloadx',
    version: '1.0.0',
    transport: 'streamable-http',
    authenticated: !!user,
    user: user ? { id: user.id, email: user.email, authType: user.authType } : null,
    endpoints: {
      mcp: 'POST /mcp (MCP Streamable HTTP)',
      info: 'GET /mcp',
      tools: 'GET /mcp/tools',
      createToken: 'POST /api/auth/api-tokens',
    },
    auth: 'Authorization: Bearer <pxat_… API token or login JWT>',
    docs: 'See apps/backend/MCP.md',
  });
});

/**
 * GET /mcp/tools — list tool names (requires auth)
 */
router.get('/tools', async (req, res) => {
  const user = await getBearerUser(req);
  if (!user) return unauthorized(res);

  res.json({
    tools: [
      'whoami',
      'list_teams',
      'create_team',
      'list_projects',
      'create_project',
      'list_collections',
      'list_requests',
      'search_requests',
      'get_request',
      'create_collection',
      'create_folder',
      'create_request',
      'update_request',
      'delete_request',
      'list_environments',
      'create_environment',
      'list_workflows',
      'get_workflow',
      'create_workflow',
      'update_workflow',
      'delete_workflow',
      'build_workflow_from_requests',
      'set_workflow_order',
      'add_workflow_api_node',
      'list_workflow_executions',
    ],
  });
});

/**
 * POST /mcp — MCP Streamable HTTP (stateless)
 */
router.post('/', async (req, res) => {
  const user = await getBearerUser(req);
  if (!user) return unauthorized(res);

  const server = createPayloadXMcpServer(user);
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
  } catch (error) {
    console.error('[MCP POST /mcp]', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

router.get('/session', (_req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed (stateless MCP). Use POST /mcp.' },
    id: null,
  });
});

router.delete('/', (_req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed (stateless MCP).' },
    id: null,
  });
});

export default router;
