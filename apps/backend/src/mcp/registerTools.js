import { z } from 'zod/v4';
import { v4 as uuidv4 } from 'uuid';
import Team from '../../models/Team.js';
import Project from '../../models/Project.js';
import Collection from '../../models/Collection.js';
import Request from '../../models/Request.js';
import Environment, { maskSecrets } from '../../models/Environment.js';
import { buildRequestSearchFilter } from '../lib/requestSearch.js';
import { logActivity } from '../lib/activityLog.js';
import {
  assertTeamAccess,
  errorResult,
  serializeDoc,
  textResult,
  toObjectId,
} from './helpers.js';
import { registerWorkflowTools } from './registerWorkflowTools.js';
import { db as firestoreDb } from '../lib/firebase.js';

/**
 * Register all PayloadX MCP tools on an McpServer instance.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {{ id: string, email?: string, name?: string }} user
 */
export function registerPayloadXTools(server, user) {
  const userId = user.id || user._id;

  server.registerTool(
    'whoami',
    {
      description: 'Return the authenticated PayloadX user for this MCP session.',
      inputSchema: {},
    },
    async () => textResult({ user: { id: userId, email: user.email, name: user.name } })
  );

  server.registerTool(
    'list_teams',
    {
      description: 'List teams the authenticated user belongs to.',
      inputSchema: {},
    },
    async () => {
      try {
        const teams = await Team.find({
          $or: [{ ownerId: userId }, { 'members.userId': userId }],
        })
          .select('_id name description ownerId createdAt updatedAt')
          .lean();
        return textResult({
          teams: teams.map((t) => ({
            id: String(t._id),
            name: t.name,
            description: t.description || '',
          })),
        });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'create_team',
    {
      description: 'Create a new PayloadX team. Returns the new team id.',
      inputSchema: {
        name: z.string().describe('Team name'),
        description: z.string().optional().describe('Optional team description'),
      },
    },
    async ({ name, description }) => {
      try {
        const team = await Team.create({
          name: name.trim(),
          description: description || '',
          ownerId: userId,
          members: [{ userId, role: 'admin' }],
          inviteToken: uuidv4(),
        });
        logActivity({
          userId,
          teamId: team._id,
          action: 'create_team',
          entityId: team._id,
          entityType: 'team',
          metadata: { name: team.name, source: 'mcp' },
        });
        return textResult({
          message: 'Team created',
          team: {
            id: String(team._id),
            name: team.name,
            description: team.description || '',
          },
        });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'list_projects',
    {
      description: 'List projects for a team.',
      inputSchema: {
        teamId: z.string().describe('Team ID'),
      },
    },
    async ({ teamId }) => {
      try {
        await assertTeamAccess(teamId, userId);
        const projects = await Project.find({ teamId })
          .select('_id name description teamId color createdAt')
          .sort({ updatedAt: -1 })
          .lean();
        return textResult({
          projects: projects.map((p) => ({
            id: String(p._id),
            name: p.name,
            description: p.description || '',
            teamId: String(p.teamId),
            color: p.color,
          })),
        });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'create_project',
    {
      description: 'Create a new project inside a team.',
      inputSchema: {
        teamId: z.string().describe('Team ID'),
        name: z.string().describe('Project name'),
        description: z.string().optional(),
        color: z.string().optional(),
      },
    },
    async ({ teamId, name, description, color }) => {
      try {
        await assertTeamAccess(teamId, userId);
        const project = await Project.create({
          name: name.trim(),
          teamId,
          ownerId: userId,
          description: description || '',
          visibility: 'team',
          color: color || '#3B82F6',
          members: [{ userId, role: 'admin' }],
        });
        logActivity({
          userId,
          teamId,
          action: 'create_project',
          entityId: project._id,
          entityType: 'project',
          metadata: { name: project.name, source: 'mcp' },
        });
        return textResult({
          message: 'Project created',
          project: {
            id: String(project._id),
            name: project.name,
            teamId: String(project.teamId),
            description: project.description || '',
            color: project.color,
          },
        });
      } catch (err) {
        return errorResult(err.message);
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
        await assertTeamAccess(teamId, userId);
        const query = { teamId };
        if (projectId) query.projectId = projectId;
        const collections = await Collection.find(query)
          .select('_id name description projectId teamId folders createdAt updatedAt')
          .sort({ updatedAt: -1 })
          .lean();
        return textResult({
          collections: collections.map((c) => ({
            id: String(c._id),
            name: c.name,
            description: c.description || '',
            projectId: String(c.projectId),
            teamId: String(c.teamId),
            folderCount: (c.folders || []).length,
          })),
        });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'list_requests',
    {
      description: 'List saved API requests filtered by collection, project, or team.',
      inputSchema: {
        teamId: z.string().describe('Team ID'),
        projectId: z.string().optional().describe('Project ID'),
        collectionId: z.string().optional().describe('Collection ID'),
        limit: z.number().int().min(1).max(200).optional().describe('Max results (default 50)'),
      },
    },
    async ({ teamId, projectId, collectionId, limit }) => {
      try {
        await assertTeamAccess(teamId, userId);
        const query = { teamId };
        if (projectId) query.projectId = projectId;
        if (collectionId) query.collectionId = collectionId;
        const requests = await Request.find(query)
          .select('_id name method protocol url collectionId projectId teamId folderId description createdAt updatedAt')
          .sort({ order: 1, createdAt: 1 })
          .limit(limit || 50)
          .lean();
        return textResult({
          requests: requests.map((r) => ({
            id: String(r._id),
            name: r.name,
            method: r.method,
            protocol: r.protocol,
            url: r.url,
            collectionId: String(r.collectionId),
            projectId: String(r.projectId),
            folderId: r.folderId,
            description: r.description || '',
          })),
        });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'search_requests',
    {
      description: 'Search saved APIs by name, URL, method, or description within a team/project.',
      inputSchema: {
        teamId: z.string().describe('Team ID'),
        projectId: z.string().optional().describe('Project ID'),
        query: z.string().describe('Search text, e.g. "GET /leaves" or "approve"'),
      },
    },
    async ({ teamId, projectId, query }) => {
      try {
        await assertTeamAccess(teamId, userId);
        const filter = { teamId };
        if (projectId) filter.projectId = projectId;
        const searchFilter = buildRequestSearchFilter(String(query));
        if (searchFilter) {
          filter.$and = [...(filter.$and || []), searchFilter];
        }
        const requests = await Request.find(filter)
          .select('_id name method protocol url collectionId projectId description')
          .limit(100)
          .lean();
        return textResult({
          count: requests.length,
          requests: requests.map((r) => ({
            id: String(r._id),
            name: r.name,
            method: r.method,
            protocol: r.protocol,
            url: r.url,
            collectionId: String(r.collectionId),
            projectId: String(r.projectId),
          })),
        });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'get_request',
    {
      description: 'Get full details of a saved API request by ID.',
      inputSchema: {
        requestId: z.string().describe('Request ID'),
      },
    },
    async ({ requestId }) => {
      try {
        const reqDoc = await Request.findById(requestId).lean();
        if (!reqDoc) return errorResult('Request not found');
        await assertTeamAccess(reqDoc.teamId, userId);
        return textResult({ request: serializeDoc(reqDoc) });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'create_collection',
    {
      description: 'Create a new API collection in a project. Use this to group related APIs.',
      inputSchema: {
        teamId: z.string().describe('Team ID'),
        projectId: z.string().describe('Project ID'),
        name: z.string().describe('Collection name'),
        description: z.string().optional().describe('Optional description'),
      },
    },
    async ({ teamId, projectId, name, description }) => {
      try {
        await assertTeamAccess(teamId, userId);
        toObjectId(projectId, 'projectId');
        const collection = await Collection.create({
          name: name.trim(),
          projectId,
          teamId,
          createdBy: userId,
          description: description || '',
        });
        logActivity({
          userId,
          teamId,
          action: 'create_collection',
          entityId: collection._id,
          entityType: 'collection',
          metadata: { name: collection.name, projectId, source: 'mcp' },
        });
        return textResult({
          message: 'Collection created',
          collection: {
            id: String(collection._id),
            name: collection.name,
            projectId: String(collection.projectId),
            teamId: String(collection.teamId),
          },
        });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'create_folder',
    {
      description: 'Create a folder inside a collection to organize requests.',
      inputSchema: {
        collectionId: z.string().describe('Collection ID'),
        name: z.string().describe('Folder name'),
        parentId: z.string().nullable().optional().describe('Parent folder ID, or null for root'),
      },
    },
    async ({ collectionId, name, parentId }) => {
      try {
        const collection = await Collection.findById(collectionId);
        if (!collection) return errorResult('Collection not found');
        await assertTeamAccess(collection.teamId, userId);

        const folder = {
          id: uuidv4(),
          name: name.trim(),
          parentId: parentId || null,
          order: (collection.folders || []).length,
        };
        collection.folders = [...(collection.folders || []), folder];
        await collection.save();

        return textResult({
          message: 'Folder created',
          folder,
          collectionId: String(collection._id),
        });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'create_request',
    {
      description:
        'Create a new API request (REST/WS/Socket.IO) in PayloadX. This is the main tool for adding APIs from Cursor/Claude into the user’s workspace.',
      inputSchema: {
        teamId: z.string().describe('Team ID'),
        projectId: z.string().describe('Project ID'),
        collectionId: z.string().describe('Collection ID where the API will be saved'),
        name: z.string().describe('Display name for the API'),
        method: z
          .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
          .optional()
          .describe('HTTP method (default GET). Ignored for ws/socketio.'),
        url: z.string().optional().describe('Request URL, may include {{env}} variables'),
        protocol: z.enum(['http', 'ws', 'socketio']).optional().describe('Protocol, default http'),
        description: z.string().optional().describe('Optional description'),
        folderId: z.string().nullable().optional().describe('Optional folder ID inside the collection'),
        headers: z
          .array(
            z.object({
              key: z.string(),
              value: z.string(),
              enabled: z.boolean().optional(),
              description: z.string().optional(),
            })
          )
          .optional()
          .describe('Request headers'),
        params: z
          .array(
            z.object({
              key: z.string(),
              value: z.string(),
              enabled: z.boolean().optional(),
              description: z.string().optional(),
            })
          )
          .optional()
          .describe('Query params'),
        bodyMode: z.enum(['none', 'raw', 'form-data', 'urlencoded']).optional(),
        bodyRaw: z.string().optional().describe('Raw body (JSON/text) when bodyMode is raw'),
        bodyRawLanguage: z.enum(['json', 'text', 'xml', 'html', 'javascript']).optional(),
      },
    },
    async (args) => {
      try {
        const {
          teamId,
          projectId,
          collectionId,
          name,
          method = 'GET',
          url = '',
          protocol = 'http',
          description = '',
          folderId = null,
          headers = [],
          params = [],
          bodyMode = 'none',
          bodyRaw = '',
          bodyRawLanguage = 'json',
        } = args;

        await assertTeamAccess(teamId, userId);
        toObjectId(projectId, 'projectId');
        toObjectId(collectionId, 'collectionId');

        const collection = await Collection.findById(collectionId).lean();
        if (!collection) return errorResult('Collection not found');
        if (String(collection.teamId) !== String(teamId)) {
          return errorResult('Collection does not belong to this team');
        }
        if (String(collection.projectId) !== String(projectId)) {
          return errorResult('Collection does not belong to this project');
        }

        const createData = {
          name: name.trim(),
          url,
          protocol,
          collectionId,
          projectId,
          teamId,
          creatorId: userId,
          description,
          folderId: folderId || null,
          headers: (headers || []).map((h) => ({
            key: h.key,
            value: h.value,
            enabled: h.enabled !== false,
            description: h.description || '',
          })),
          params: (params || []).map((p) => ({
            key: p.key,
            value: p.value,
            enabled: p.enabled !== false,
            description: p.description || '',
          })),
          body: {
            mode: bodyMode || 'none',
            raw: bodyRaw || '',
            rawLanguage: bodyRawLanguage || 'json',
            formData: [],
            urlencoded: [],
          },
        };

        if (protocol === 'http') {
          createData.method = method || 'GET';
        }

        const newReq = await Request.create(createData);
        logActivity({
          userId,
          teamId,
          action: 'create_request',
          entityId: newReq._id,
          entityType: 'request',
          metadata: {
            name: newReq.name,
            method: newReq.method,
            protocol: newReq.protocol,
            projectId,
            collectionId,
            source: 'mcp',
          },
        });

        return textResult({
          message: 'API request created in PayloadX',
          request: {
            id: String(newReq._id),
            name: newReq.name,
            method: newReq.method,
            protocol: newReq.protocol,
            url: newReq.url,
            collectionId: String(newReq.collectionId),
            projectId: String(newReq.projectId),
            teamId: String(newReq.teamId),
          },
        });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'update_request',
    {
      description: 'Update an existing PayloadX API request (name, method, url, headers, body, etc.).',
      inputSchema: {
        requestId: z.string().describe('Request ID to update'),
        name: z.string().optional(),
        method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']).optional(),
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
              description: z.string().optional(),
            })
          )
          .optional(),
        params: z
          .array(
            z.object({
              key: z.string(),
              value: z.string(),
              enabled: z.boolean().optional(),
              description: z.string().optional(),
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
        const existing = await Request.findById(args.requestId);
        if (!existing) return errorResult('Request not found');
        await assertTeamAccess(existing.teamId, userId);

        const patch = {};
        for (const key of ['name', 'method', 'url', 'protocol', 'description', 'folderId']) {
          if (args[key] !== undefined) patch[key] = args[key];
        }
        if (args.headers) {
          patch.headers = args.headers.map((h) => ({
            key: h.key,
            value: h.value,
            enabled: h.enabled !== false,
            description: h.description || '',
          }));
        }
        if (args.params) {
          patch.params = args.params.map((p) => ({
            key: p.key,
            value: p.value,
            enabled: p.enabled !== false,
            description: p.description || '',
          }));
        }
        if (args.bodyMode || args.bodyRaw !== undefined || args.bodyRawLanguage) {
          patch.body = {
            ...(existing.body?.toObject?.() || existing.body || {}),
            mode: args.bodyMode || existing.body?.mode || 'none',
            raw: args.bodyRaw !== undefined ? args.bodyRaw : existing.body?.raw || '',
            rawLanguage: args.bodyRawLanguage || existing.body?.rawLanguage || 'json',
          };
        }

        const updated = await Request.findByIdAndUpdate(args.requestId, patch, {
          new: true,
          runValidators: true,
        }).lean();

        logActivity({
          userId,
          teamId: existing.teamId,
          action: 'update_request',
          entityId: existing._id,
          entityType: 'request',
          metadata: { name: updated.name, source: 'mcp' },
        });

        return textResult({
          message: 'Request updated',
          request: {
            id: String(updated._id),
            name: updated.name,
            method: updated.method,
            protocol: updated.protocol,
            url: updated.url,
          },
        });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'delete_request',
    {
      description: 'Delete a saved API request from PayloadX.',
      inputSchema: {
        requestId: z.string().describe('Request ID to delete'),
      },
    },
    async ({ requestId }) => {
      try {
        const existing = await Request.findById(requestId).lean();
        if (!existing) return errorResult('Request not found');
        await assertTeamAccess(existing.teamId, userId);
        await Request.findByIdAndDelete(requestId);
        logActivity({
          userId,
          teamId: existing.teamId,
          action: 'delete_request',
          entityId: existing._id,
          entityType: 'request',
          metadata: { name: existing.name, source: 'mcp' },
        });
        return textResult({ message: 'Request deleted', requestId });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'list_environments',
    {
      description: 'List environments for a project.',
      inputSchema: {
        teamId: z.string().describe('Team ID'),
        projectId: z.string().describe('Project ID'),
      },
    },
    async ({ teamId, projectId }) => {
      try {
        await assertTeamAccess(teamId, userId);
        const envs = await Environment.find({ projectId }).sort({ name: 1 });
        return textResult({
          environments: envs.map((e) => {
            const safe = maskSecrets(e);
            return {
              id: String(safe._id),
              name: safe.name,
              description: safe.description || '',
              variableCount: (safe.variables || []).length,
            };
          }),
        });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'create_environment',
    {
      description: 'Create an environment with optional key/value variables for a project.',
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
              description: z.string().optional(),
            })
          )
          .optional(),
      },
    },
    async ({ teamId, projectId, name, description, variables }) => {
      try {
        await assertTeamAccess(teamId, userId);
        const env = await Environment.create({
          name: name.trim(),
          description: description || '',
          projectId,
          teamId,
          createdBy: userId,
          variables: (variables || []).map((v) => ({
            key: v.key,
            value: v.value,
            enabled: v.enabled !== false,
            isSecret: !!v.isSecret,
            description: v.description || '',
          })),
        });
        return textResult({
          message: 'Environment created',
          environment: {
            id: String(env._id),
            name: env.name,
            projectId: String(env.projectId),
            teamId: String(env.teamId),
          },
        });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );

  // Workflows (Firestore) — create / edit / order APIs
  registerWorkflowTools(server, {
    mode: 'firestore',
    userId,
    db: firestoreDb,
    assertTeamAccess,
    Request,
  });
}
