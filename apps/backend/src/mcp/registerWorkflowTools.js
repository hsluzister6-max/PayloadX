import { z } from 'zod/v4';
import { randomUUID } from 'crypto';
import { errorResult, textResult } from './helpers.js';
import {
  buildLinearWorkflowGraph,
  reorderWorkflowGraph,
  summarizeWorkflow,
} from './workflowHelpers.js';

const kvSchema = z.object({
  key: z.string(),
  value: z.string(),
  enabled: z.boolean().optional(),
  id: z.string().optional(),
});

const nodeDataSchema = z
  .object({
    name: z.string(),
    method: z.string().optional(),
    url: z.string().optional(),
    headers: z.array(kvSchema).optional(),
    params: z.array(kvSchema).optional(),
    body: z.any().optional(),
    data_mappings: z.array(z.any()).optional(),
    validations: z.array(z.any()).optional(),
    timeout: z.number().optional(),
    retries: z.number().optional(),
    save_session: z.boolean().optional(),
    skipped: z.boolean().optional(),
    expected_response: z.string().optional(),
    manual_inputs: z.array(z.any()).optional(),
    step: z.number().optional(),
    sourceRequestId: z.string().nullable().optional(),
  })
  .passthrough();

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum(['api', 'condition', 'delay', 'transform']).default('api'),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  data: nodeDataSchema,
});

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  type: z.string().optional(),
  condition: z.enum(['always', 'success', 'failure']).optional(),
  animated: z.boolean().optional(),
});

function apiError(err) {
  const msg =
    err.response?.data?.error ||
    err.response?.data?.message ||
    err.message ||
    'Request failed';
  return errorResult(msg);
}

/**
 * Register workflow MCP tools.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {{
 *   mode: 'api' | 'firestore',
 *   api?: ReturnType<import('./apiClient.js').createApiClient>,
 *   userId?: string,
 *   db?: import('firebase-admin').firestore.Firestore | null,
 *   assertTeamAccess?: (teamId: string, userId: string) => Promise<any>,
 *   Request?: any,
 * }} deps
 */
export function registerWorkflowTools(server, deps) {
  const isApi = deps.mode === 'api';

  async function listWorkflows({ teamId, projectId, search }) {
    if (isApi) {
      const data = await deps.api.get('/api/workflow', {
        teamId,
        ...(projectId ? { projectId } : {}),
        ...(search ? { search } : {}),
      });
      return data.workflows || [];
    }
    if (!deps.db) throw new Error('Firestore not initialized');
    await deps.assertTeamAccess(teamId, deps.userId);
    let query = deps.db.collection('workflows').where('teamId', '==', teamId);
    if (projectId) query = query.where('projectId', '==', projectId);
    const snapshot = await query.get();
    let workflows = snapshot.docs.map((doc) => ({
      _id: doc.id,
      id: doc.id,
      ...doc.data(),
    }));
    workflows.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    if (search) {
      const q = search.toLowerCase();
      workflows = workflows.filter((w) => (w.name || '').toLowerCase().includes(q));
    }
    return workflows;
  }

  async function getWorkflow(workflowId) {
    if (isApi) {
      const data = await deps.api.get(`/api/workflow/${workflowId}`);
      return data.workflow;
    }
    if (!deps.db) throw new Error('Firestore not initialized');
    const doc = await deps.db.collection('workflows').doc(workflowId).get();
    if (!doc.exists) throw new Error('Workflow not found');
    const workflow = { _id: doc.id, id: doc.id, ...doc.data() };
    if (workflow.teamId) await deps.assertTeamAccess(workflow.teamId, deps.userId);
    return workflow;
  }

  async function createWorkflow(payload) {
    if (isApi) {
      const data = await deps.api.post('/api/workflow', payload);
      return data.workflow;
    }
    if (!deps.db) throw new Error('Firestore not initialized');
    await deps.assertTeamAccess(payload.teamId, deps.userId);
    const now = new Date().toISOString();
    const workflowPayload = {
      name: payload.name,
      description: payload.description || '',
      teamId: payload.teamId,
      projectId: payload.projectId || null,
      nodes: payload.nodes || [],
      edges: payload.edges || [],
      createdBy: deps.userId,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await deps.db.collection('workflows').add(workflowPayload);
    return { _id: docRef.id, id: docRef.id, ...workflowPayload };
  }

  async function updateWorkflow(workflowId, patch) {
    if (isApi) {
      const data = await deps.api.put(`/api/workflow/${workflowId}`, patch);
      return data.workflow;
    }
    if (!deps.db) throw new Error('Firestore not initialized');
    const docRef = deps.db.collection('workflows').doc(workflowId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error('Workflow not found');
    const current = doc.data();
    await deps.assertTeamAccess(current.teamId, deps.userId);
    const updates = {
      updatedAt: new Date().toISOString(),
      version: (current.version || 0) + 1,
    };
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.nodes !== undefined) updates.nodes = patch.nodes;
    if (patch.edges !== undefined) updates.edges = patch.edges;
    await docRef.update(updates);
    const updated = await docRef.get();
    return { _id: updated.id, id: updated.id, ...updated.data() };
  }

  async function deleteWorkflow(workflowId) {
    if (isApi) {
      await deps.api.del(`/api/workflow/${workflowId}`);
      return;
    }
    if (!deps.db) throw new Error('Firestore not initialized');
    const docRef = deps.db.collection('workflows').doc(workflowId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error('Workflow not found');
    await deps.assertTeamAccess(doc.data().teamId, deps.userId);
    await docRef.delete();
  }

  async function loadRequestsByIds(requestIds) {
    const ids = (requestIds || []).map(String);
    if (isApi) {
      const out = [];
      for (const id of ids) {
        const data = await deps.api.get(`/api/request/${id}`);
        if (data.request) out.push(data.request);
      }
      return out;
    }
    const docs = await deps.Request.find({ _id: { $in: ids } }).lean();
    const map = new Map(docs.map((d) => [String(d._id), d]));
    return ids.map((id) => map.get(id)).filter(Boolean);
  }

  server.registerTool(
    'list_workflows',
    {
      description:
        'List workflows for a team (optional project/search filter). Returns id, name, node/edge counts.',
      inputSchema: {
        teamId: z.string().describe('Team ID'),
        projectId: z.string().optional().describe('Optional project ID'),
        search: z.string().optional().describe('Optional name search'),
      },
    },
    async (args) => {
      try {
        const workflows = await listWorkflows(args);
        return textResult({
          count: workflows.length,
          workflows: workflows.map(summarizeWorkflow),
        });
      } catch (err) {
        return isApi ? apiError(err) : errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'get_workflow',
    {
      description:
        'Get full workflow including nodes (API steps) and edges (ordering / success-failure links).',
      inputSchema: {
        workflowId: z.string().describe('Workflow Firestore document id'),
      },
    },
    async ({ workflowId }) => {
      try {
        const workflow = await getWorkflow(workflowId);
        return textResult({ workflow });
      } catch (err) {
        return isApi ? apiError(err) : errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'create_workflow',
    {
      description:
        'Create a workflow. Pass nodes + edges to define API steps and ordering. Prefer build_workflow_from_requests to auto-build from saved APIs.',
      inputSchema: {
        teamId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        projectId: z.string().optional(),
        nodes: z.array(nodeSchema).optional().describe('Workflow nodes (api/delay/…)'),
        edges: z.array(edgeSchema).optional().describe('Edges connecting nodes (ordering)'),
      },
    },
    async ({ teamId, name, description, projectId, nodes, edges }) => {
      try {
        const workflow = await createWorkflow({
          teamId,
          name: name.trim(),
          description: description || '',
          projectId: projectId || null,
          nodes: nodes || [],
          edges: edges || [],
        });
        return textResult({
          message: 'Workflow created',
          workflow: summarizeWorkflow(workflow),
          nodes: workflow.nodes || [],
          edges: workflow.edges || [],
        });
      } catch (err) {
        return isApi ? apiError(err) : errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'update_workflow',
    {
      description:
        'Update workflow name/description and/or replace full nodes + edges graph (ordering, APIs, delays).',
      inputSchema: {
        workflowId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        nodes: z.array(nodeSchema).optional(),
        edges: z.array(edgeSchema).optional(),
      },
    },
    async ({ workflowId, name, description, nodes, edges }) => {
      try {
        const patch = {};
        if (name !== undefined) patch.name = name;
        if (description !== undefined) patch.description = description;
        if (nodes !== undefined) patch.nodes = nodes;
        if (edges !== undefined) patch.edges = edges;
        const workflow = await updateWorkflow(workflowId, patch);
        return textResult({
          message: 'Workflow updated',
          workflow: summarizeWorkflow(workflow),
          nodes: workflow.nodes || [],
          edges: workflow.edges || [],
        });
      } catch (err) {
        return isApi ? apiError(err) : errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'delete_workflow',
    {
      description: 'Delete a workflow permanently.',
      inputSchema: { workflowId: z.string() },
    },
    async ({ workflowId }) => {
      try {
        await deleteWorkflow(workflowId);
        return textResult({ message: 'Workflow deleted', workflowId });
      } catch (err) {
        return isApi ? apiError(err) : errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'build_workflow_from_requests',
    {
      description:
        'Create a workflow from saved PayloadX API request IDs in order. Builds api nodes + success edges (step 1→2→3…). Use get_request/list_requests first to pick IDs.',
      inputSchema: {
        teamId: z.string(),
        projectId: z.string().optional(),
        name: z.string().describe('Workflow name'),
        description: z.string().optional(),
        requestIds: z
          .array(z.string())
          .min(1)
          .describe('Ordered list of request IDs — first runs first'),
      },
    },
    async ({ teamId, projectId, name, description, requestIds }) => {
      try {
        const requests = await loadRequestsByIds(requestIds);
        if (!requests.length) return errorResult('No matching requests found for requestIds');
        if (requests.length !== requestIds.length) {
          return errorResult(
            `Only found ${requests.length}/${requestIds.length} requests. Check IDs.`
          );
        }
        for (const r of requests) {
          if (String(r.teamId) !== String(teamId)) {
            return errorResult(`Request "${r.name}" does not belong to team ${teamId}`);
          }
        }
        const { nodes, edges } = buildLinearWorkflowGraph(requests);
        const workflow = await createWorkflow({
          teamId,
          projectId: projectId || requests[0].projectId || null,
          name: name.trim(),
          description: description || `Built from ${requests.length} APIs via MCP`,
          nodes,
          edges,
        });
        return textResult({
          message: 'Workflow created from PayloadX APIs',
          workflow: summarizeWorkflow(workflow),
          order: requests.map((r, i) => ({
            step: i + 1,
            requestId: String(r._id),
            name: r.name,
            method: r.method,
            url: r.url,
          })),
          nodes,
          edges,
        });
      } catch (err) {
        return isApi ? apiError(err) : errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'set_workflow_order',
    {
      description:
        'Reorder workflow nodes into a linear success chain. Pass ordered nodeIds (from get_workflow). Rebuilds edges and data.step.',
      inputSchema: {
        workflowId: z.string(),
        orderedNodeIds: z
          .array(z.string())
          .min(1)
          .describe('Node ids in desired execution order'),
        keepOthers: z
          .boolean()
          .optional()
          .describe('Append nodes not listed (default true)'),
      },
    },
    async ({ workflowId, orderedNodeIds, keepOthers }) => {
      try {
        const current = await getWorkflow(workflowId);
        const { nodes, edges } = reorderWorkflowGraph(current.nodes || [], orderedNodeIds, {
          keepOthers: keepOthers !== false,
        });
        const workflow = await updateWorkflow(workflowId, { nodes, edges });
        return textResult({
          message: 'Workflow order updated',
          workflow: summarizeWorkflow(workflow),
          order: nodes.map((n) => ({
            step: n.data?.step,
            nodeId: n.id,
            name: n.data?.name,
            method: n.data?.method,
          })),
          nodes,
          edges,
        });
      } catch (err) {
        return isApi ? apiError(err) : errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'add_workflow_api_node',
    {
      description:
        'Append (or insert) an API step onto a workflow. Can copy from a saved requestId or pass method/url manually. Optionally connect after afterNodeId.',
      inputSchema: {
        workflowId: z.string(),
        requestId: z.string().optional().describe('Copy fields from saved PayloadX request'),
        name: z.string().optional(),
        method: z
          .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
          .optional(),
        url: z.string().optional(),
        headers: z.array(kvSchema).optional(),
        params: z.array(kvSchema).optional(),
        body: z.any().optional(),
        afterNodeId: z
          .string()
          .optional()
          .describe('Insert after this node (default: append at end)'),
        connectCondition: z
          .enum(['always', 'success', 'failure'])
          .optional()
          .describe('Edge condition from previous node (default success)'),
      },
    },
    async (args) => {
      try {
        const current = await getWorkflow(args.workflowId);
        let name = args.name;
        let method = args.method || 'GET';
        let url = args.url || '';
        let headers = args.headers || [];
        let params = args.params || [];
        let body = args.body ?? null;
        let sourceRequestId = null;

        if (args.requestId) {
          const [req] = await loadRequestsByIds([args.requestId]);
          if (!req) return errorResult('Request not found');
          name = name || req.name;
          method = args.method || req.method || 'GET';
          url = args.url !== undefined ? args.url : req.url || '';
          headers = args.headers || req.headers || [];
          params = args.params || req.params || [];
          if (args.body === undefined) {
            const { bodyFromRequest } = await import('./workflowHelpers.js');
            body = bodyFromRequest(req);
          }
          sourceRequestId = String(req._id);
        }

        if (!name) return errorResult('name or requestId is required');

        const nodes = [...(current.nodes || [])];
        const edges = [...(current.edges || [])];
        const newId = `api_${randomUUID().slice(0, 8)}`;
        const insertAfter = args.afterNodeId
          ? nodes.findIndex((n) => n.id === args.afterNodeId)
          : nodes.length - 1;

        const newNode = {
          id: newId,
          type: 'api',
          position: {
            x: 160,
            y: 80 + Math.max(insertAfter + 1, 0) * 200,
          },
          data: {
            name,
            method,
            url,
            headers,
            params,
            body,
            data_mappings: [],
            validations: [],
            timeout: 30,
            retries: 0,
            save_session: false,
            skipped: false,
            manual_inputs: [],
            step: insertAfter + 2,
            sourceRequestId,
          },
        };

        const at = insertAfter < 0 ? nodes.length : insertAfter + 1;
        nodes.splice(at, 0, newNode);

        // Rebuild linear success chain order by current array order for simplicity
        // when afterNodeId was used; preserve non-linear only if no afterNodeId and edges exist?
        // User asked for ordering control — rebuild linear from nodes array order.
        const orderedIds = nodes.map((n) => n.id);
        const graph = reorderWorkflowGraph(nodes, orderedIds, { keepOthers: false });

        // If custom connectCondition on the edge into new node
        const condition = args.connectCondition || 'success';
        if (at > 0 && graph.edges[at - 1]) {
          graph.edges[at - 1].condition = condition;
          graph.edges[at - 1].sourceHandle = condition;
        }

        const workflow = await updateWorkflow(args.workflowId, {
          nodes: graph.nodes,
          edges: graph.edges,
        });

        return textResult({
          message: 'API node added to workflow',
          nodeId: newId,
          workflow: summarizeWorkflow(workflow),
          order: graph.nodes.map((n) => ({
            step: n.data?.step,
            nodeId: n.id,
            name: n.data?.name,
            method: n.data?.method,
          })),
        });
      } catch (err) {
        return isApi ? apiError(err) : errorResult(err.message);
      }
    }
  );

  server.registerTool(
    'list_workflow_executions',
    {
      description: 'List recent workflow run history (client-reported executions).',
      inputSchema: {
        teamId: z.string().optional(),
        workflowId: z.string().optional(),
        status: z.enum(['success', 'failed', 'partial']).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ teamId, workflowId, status, limit }) => {
      try {
        if (isApi) {
          const data = await deps.api.get('/api/workflow-execution', {
            ...(teamId ? { teamId } : {}),
            ...(workflowId ? { workflowId } : {}),
            ...(status ? { status } : {}),
            limit: limit || 20,
          });
          return textResult({
            count: (data.executions || []).length,
            executions: data.executions || [],
          });
        }
        if (!deps.db) throw new Error('Firestore not initialized');
        let query = deps.db.collection('workflow_executions');
        if (workflowId) query = query.where('workflowId', '==', workflowId);
        if (teamId) query = query.where('teamId', '==', teamId);
        if (status) query = query.where('status', '==', status);
        const snapshot = await query.limit(limit || 20).get();
        const executions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        return textResult({ count: executions.length, executions });
      } catch (err) {
        return isApi ? apiError(err) : errorResult(err.message);
      }
    }
  );
}
