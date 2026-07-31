import { z } from 'zod/v4';
import { errorResult, textResult } from './helpers.js';

function apiError(err) {
  const msg =
    err.response?.data?.error ||
    err.response?.data?.message ||
    err.message ||
    'Request failed';
  return errorResult(msg);
}

/**
 * Register PayloadX tools that call the public REST API with a user JWT.
 * No MongoDB / JWT_SECRET needed on the client machine.
 */
export function registerPayloadXToolsViaApi(server, api) {
  server.registerTool(
    'whoami',
    {
      description: 'Return the authenticated PayloadX user for this MCP session.',
      inputSchema: {},
    },
    async () => {
      try {
        // Prefer /api/auth/me if present; otherwise echo token presence
        try {
          const data = await api.get('/api/auth/me');
          return textResult({ user: data.user || data });
        } catch {
          return textResult({
            authenticated: true,
            baseUrl: api.baseUrl,
            note: 'Token accepted by MCP client. Use list_teams to verify access.',
          });
        }
      } catch (err) {
        return apiError(err);
      }
    }
  );

  server.registerTool(
    'list_teams',
    {
      description: 'List teams the authenticated user belongs to.',
      inputSchema: {},
    },
    async () => {
      try {
        const data = await api.get('/api/team');
        const teams = (data.teams || []).map((t) => ({
          id: String(t._id),
          name: t.name,
          description: t.description || '',
        }));
        return textResult({ teams });
      } catch (err) {
        return apiError(err);
      }
    }
  );

  server.registerTool(
    'list_projects',
    {
      description: 'List projects for a team.',
      inputSchema: { teamId: z.string().describe('Team ID') },
    },
    async ({ teamId }) => {
      try {
        const data = await api.get('/api/project', { teamId });
        const projects = (data.projects || []).map((p) => ({
          id: String(p._id),
          name: p.name,
          description: p.description || '',
          teamId: String(p.teamId),
        }));
        return textResult({ projects });
      } catch (err) {
        return apiError(err);
      }
    }
  );

  server.registerTool(
    'list_collections',
    {
      description: 'List API collections in a project (or whole team).',
      inputSchema: {
        teamId: z.string().describe('Team ID'),
        projectId: z.string().optional().describe('Optional project ID filter'),
      },
    },
    async ({ teamId, projectId }) => {
      try {
        const data = await api.get('/api/collection', {
          teamId,
          ...(projectId ? { projectId } : {}),
        });
        const collections = (data.collections || []).map((c) => ({
          id: String(c._id),
          name: c.name,
          description: c.description || '',
          projectId: String(c.projectId),
          teamId: String(c.teamId),
        }));
        return textResult({ collections });
      } catch (err) {
        return apiError(err);
      }
    }
  );

  server.registerTool(
    'list_requests',
    {
      description: 'List saved API requests filtered by collection, project, or team.',
      inputSchema: {
        teamId: z.string().describe('Team ID'),
        projectId: z.string().optional(),
        collectionId: z.string().optional(),
      },
    },
    async ({ teamId, projectId, collectionId }) => {
      try {
        const data = await api.get('/api/request', {
          teamId,
          ...(projectId ? { projectId } : {}),
          ...(collectionId ? { collectionId } : {}),
        });
        const requests = (data.requests || []).map((r) => ({
          id: String(r._id),
          name: r.name,
          method: r.method,
          protocol: r.protocol,
          url: r.url,
          collectionId: String(r.collectionId),
          projectId: String(r.projectId),
        }));
        return textResult({ requests });
      } catch (err) {
        return apiError(err);
      }
    }
  );

  server.registerTool(
    'search_requests',
    {
      description: 'Search saved APIs by name, URL, method, or description.',
      inputSchema: {
        teamId: z.string(),
        projectId: z.string().optional(),
        query: z.string().describe('Search text'),
      },
    },
    async ({ teamId, projectId, query }) => {
      try {
        const data = await api.get('/api/request', {
          teamId,
          search: query,
          ...(projectId ? { projectId } : {}),
        });
        const requests = (data.requests || []).map((r) => ({
          id: String(r._id),
          name: r.name,
          method: r.method,
          url: r.url,
          collectionId: String(r.collectionId),
        }));
        return textResult({ count: requests.length, requests });
      } catch (err) {
        return apiError(err);
      }
    }
  );

  server.registerTool(
    'get_request',
    {
      description: 'Get full details of a saved API request by ID.',
      inputSchema: { requestId: z.string() },
    },
    async ({ requestId }) => {
      try {
        const data = await api.get(`/api/request/${requestId}`);
        return textResult({ request: data.request });
      } catch (err) {
        return apiError(err);
      }
    }
  );

  server.registerTool(
    'create_collection',
    {
      description: 'Create a new API collection in a project.',
      inputSchema: {
        teamId: z.string(),
        projectId: z.string(),
        name: z.string(),
        description: z.string().optional(),
      },
    },
    async ({ teamId, projectId, name, description }) => {
      try {
        const data = await api.post('/api/collection', {
          teamId,
          projectId,
          name,
          description: description || '',
        });
        const c = data.collection;
        return textResult({
          message: 'Collection created',
          collection: {
            id: String(c._id),
            name: c.name,
            projectId: String(c.projectId),
            teamId: String(c.teamId),
          },
        });
      } catch (err) {
        return apiError(err);
      }
    }
  );

  server.registerTool(
    'create_folder',
    {
      description: 'Create a folder inside a collection.',
      inputSchema: {
        collectionId: z.string(),
        name: z.string(),
        parentId: z.string().nullable().optional(),
      },
    },
    async ({ collectionId, name, parentId }) => {
      try {
        const data = await api.post(`/api/collection/${collectionId}/folder`, {
          name,
          parentId: parentId || null,
        });
        return textResult({
          message: 'Folder created',
          folder: data.folder,
          collectionId,
        });
      } catch (err) {
        return apiError(err);
      }
    }
  );

  server.registerTool(
    'create_request',
    {
      description:
        'Create a new API request in PayloadX. Main tool for adding APIs from Cursor/Claude.',
      inputSchema: {
        teamId: z.string(),
        projectId: z.string(),
        collectionId: z.string(),
        name: z.string(),
        method: z
          .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
          .optional(),
        url: z.string().optional(),
        protocol: z.enum(['http', 'ws', 'socketio']).optional(),
        description: z.string().optional(),
        folderId: z.string().nullable().optional(),
        headers: z
          .array(
            z.object({
              key: z.string(),
              value: z.string(),
              enabled: z.boolean().optional(),
            })
          )
          .optional(),
        params: z
          .array(
            z.object({
              key: z.string(),
              value: z.string(),
              enabled: z.boolean().optional(),
            })
          )
          .optional(),
        bodyMode: z.enum(['none', 'raw', 'form-data', 'urlencoded']).optional(),
        bodyRaw: z.string().optional(),
        bodyRawLanguage: z.enum(['json', 'text', 'xml', 'html', 'javascript']).optional(),
      },
    },
    async (args) => {
      try {
        const protocol = args.protocol || 'http';
        const body = {
          teamId: args.teamId,
          projectId: args.projectId,
          collectionId: args.collectionId,
          name: args.name,
          url: args.url || '',
          protocol,
          description: args.description || '',
          folderId: args.folderId || null,
          headers: args.headers || [],
          params: args.params || [],
          body: {
            mode: args.bodyMode || 'none',
            raw: args.bodyRaw || '',
            rawLanguage: args.bodyRawLanguage || 'json',
          },
        };
        if (protocol === 'http') body.method = args.method || 'GET';

        const data = await api.post('/api/request', body);
        const r = data.request;
        return textResult({
          message: 'API request created in PayloadX',
          request: {
            id: String(r._id),
            name: r.name,
            method: r.method,
            protocol: r.protocol,
            url: r.url,
            collectionId: String(r.collectionId),
            projectId: String(r.projectId),
            teamId: String(r.teamId),
          },
        });
      } catch (err) {
        return apiError(err);
      }
    }
  );

  server.registerTool(
    'update_request',
    {
      description: 'Update an existing PayloadX API request.',
      inputSchema: {
        requestId: z.string(),
        name: z.string().optional(),
        method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']).optional(),
        url: z.string().optional(),
        protocol: z.enum(['http', 'ws', 'socketio']).optional(),
        description: z.string().optional(),
        folderId: z.string().nullable().optional(),
        headers: z
          .array(z.object({ key: z.string(), value: z.string(), enabled: z.boolean().optional() }))
          .optional(),
        params: z
          .array(z.object({ key: z.string(), value: z.string(), enabled: z.boolean().optional() }))
          .optional(),
        bodyMode: z.enum(['none', 'raw', 'form-data', 'urlencoded']).optional(),
        bodyRaw: z.string().optional(),
        bodyRawLanguage: z.enum(['json', 'text', 'xml', 'html', 'javascript']).optional(),
      },
    },
    async (args) => {
      try {
        const { requestId, bodyMode, bodyRaw, bodyRawLanguage, ...rest } = args;
        const patch = { ...rest };
        delete patch.requestId;
        if (bodyMode || bodyRaw !== undefined || bodyRawLanguage) {
          patch.body = {
            mode: bodyMode || 'raw',
            raw: bodyRaw || '',
            rawLanguage: bodyRawLanguage || 'json',
          };
        }
        const data = await api.put(`/api/request/${requestId}`, patch);
        const r = data.request;
        return textResult({
          message: 'Request updated',
          request: {
            id: String(r._id),
            name: r.name,
            method: r.method,
            url: r.url,
          },
        });
      } catch (err) {
        return apiError(err);
      }
    }
  );

  server.registerTool(
    'delete_request',
    {
      description: 'Delete a saved API request from PayloadX.',
      inputSchema: { requestId: z.string() },
    },
    async ({ requestId }) => {
      try {
        await api.del(`/api/request/${requestId}`);
        return textResult({ message: 'Request deleted', requestId });
      } catch (err) {
        return apiError(err);
      }
    }
  );

  server.registerTool(
    'list_environments',
    {
      description: 'List environments for a project.',
      inputSchema: {
        teamId: z.string(),
        projectId: z.string(),
      },
    },
    async ({ teamId, projectId }) => {
      try {
        const data = await api.get('/api/environment', { teamId, projectId });
        const environments = (data.environments || []).map((e) => ({
          id: String(e._id),
          name: e.name,
          description: e.description || '',
        }));
        return textResult({ environments });
      } catch (err) {
        return apiError(err);
      }
    }
  );

  server.registerTool(
    'create_environment',
    {
      description: 'Create an environment with optional variables.',
      inputSchema: {
        teamId: z.string(),
        projectId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        variables: z
          .array(
            z.object({
              key: z.string(),
              value: z.string(),
              enabled: z.boolean().optional(),
              isSecret: z.boolean().optional(),
            })
          )
          .optional(),
      },
    },
    async ({ teamId, projectId, name, description, variables }) => {
      try {
        const data = await api.post('/api/environment', {
          teamId,
          projectId,
          name,
          description: description || '',
          variables: variables || [],
        });
        const e = data.environment;
        return textResult({
          message: 'Environment created',
          environment: {
            id: String(e._id),
            name: e.name,
            projectId: String(e.projectId),
            teamId: String(e.teamId),
          },
        });
      } catch (err) {
        return apiError(err);
      }
    }
  );
}
