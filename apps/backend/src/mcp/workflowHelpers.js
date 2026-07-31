import { randomUUID } from 'crypto';

/** Normalize request headers/params for a workflow api node. */
function mapKv(list = []) {
  return (list || [])
    .filter((h) => h && (h.key || h.value))
    .map((h) => ({
      id: h.id || randomUUID(),
      key: h.key || '',
      value: h.value || '',
      enabled: h.enabled !== false,
    }));
}

/** Parse request body into workflow node body (object or string). */
export function bodyFromRequest(req) {
  const mode = req?.body?.mode || 'none';
  if (mode === 'none' || !req?.body) return null;
  if (mode === 'raw') {
    const raw = req.body.raw || '';
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return req.body;
}

/**
 * Build a linear workflow graph from ordered PayloadX API requests.
 * Order of `requests` = execution order (step 1..n), edges = success chain.
 */
export function buildLinearWorkflowGraph(requests = []) {
  const nodes = (requests || []).map((req, index) => {
    const id = `api_${index + 1}_${randomUUID().slice(0, 8)}`;
    return {
      id,
      type: 'api',
      position: { x: 160, y: 80 + index * 200 },
      data: {
        name: req.name || `Step ${index + 1}`,
        method: req.method || 'GET',
        url: req.url || '',
        headers: mapKv(req.headers),
        params: mapKv(req.params),
        body: bodyFromRequest(req),
        data_mappings: [],
        validations: [],
        timeout: 30,
        retries: 0,
        save_session: false,
        skipped: false,
        expected_response: '',
        manual_inputs: [],
        step: index + 1,
        // Tracking only — desktop picker copies fields; this helps MCP round-trips
        sourceRequestId: req._id ? String(req._id) : req.id ? String(req.id) : null,
      },
    };
  });

  const edges = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    edges.push({
      id: `e_${nodes[i].id}_${nodes[i + 1].id}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
      sourceHandle: 'success',
      condition: 'success',
      type: 'smoothstep',
      animated: true,
    });
  }

  return { nodes, edges };
}

/**
 * Reorder existing nodes into a linear success chain by nodeId order.
 * Unknown ids are appended at the end (kept). Nodes not listed are dropped unless keepOthers.
 */
export function reorderWorkflowGraph(existingNodes = [], orderedNodeIds = [], { keepOthers = true } = {}) {
  const byId = new Map((existingNodes || []).map((n) => [n.id, n]));
  const ordered = [];
  for (const id of orderedNodeIds || []) {
    const n = byId.get(id);
    if (n) {
      ordered.push(n);
      byId.delete(id);
    }
  }
  if (keepOthers) {
    for (const n of byId.values()) ordered.push(n);
  }

  const nodes = ordered.map((n, index) => ({
    ...n,
    position: n.position || { x: 160, y: 80 + index * 200 },
    data: {
      ...(n.data || {}),
      step: index + 1,
    },
  }));

  const edges = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    edges.push({
      id: `e_${nodes[i].id}_${nodes[i + 1].id}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
      sourceHandle: 'success',
      condition: 'success',
      type: 'smoothstep',
      animated: true,
    });
  }

  return { nodes, edges };
}

/** Compact workflow summary for list tools. */
export function summarizeWorkflow(w) {
  return {
    id: w.id || w._id,
    name: w.name,
    description: w.description || '',
    teamId: w.teamId,
    projectId: w.projectId || null,
    version: w.version || 1,
    nodeCount: (w.nodes || []).length,
    edgeCount: (w.edges || []).length,
    updatedAt: w.updatedAt || null,
    createdAt: w.createdAt || null,
  };
}
