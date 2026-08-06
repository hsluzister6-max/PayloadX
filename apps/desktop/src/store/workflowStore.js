import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import api from '@/lib/api';
import { invoke } from '@tauri-apps/api/tauri';
import toast from 'react-hot-toast';
import { calculateLayers, deepClone } from '@/utils/perf';

// calculateLayers is imported from @/utils/perf (memoized BFS)

const isNodeSatisfied = (nodeId, edges, nodeResults) => {
  const incoming = edges.filter((e) => e.target === nodeId);
  if (incoming.length === 0) return true;

  return incoming.some((edge) => {
    const parentResult = nodeResults.find((r) => r.node_id === edge.source);
    if (!parentResult) return false;

    const condition = edge.condition || 'always';
    if (condition === 'success') return parentResult.status === 'success';
    if (condition === 'failure') return parentResult.status === 'failed';
    return parentResult.status !== 'skipped';
  });
};

const buildSkippedResult = (node) => ({
  node_id: node.id,
  node_name: node.data.name,
  start_time: new Date().toISOString(),
  end_time: new Date().toISOString(),
  duration: 0,
  status: 'skipped',
  request: null,
  response: null,
  validations: [],
  error: null,
  extracted_data: {},
});

const buildExecutionSummary = (nodeResults, workflow, durationMs, startTime) => {
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  for (const r of nodeResults) {
    if (r.status === 'success') successCount++;
    else if (r.status === 'failed') failedCount++;
    else skippedCount++;
  }

  const status = failedCount === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed';

  return {
    id: `temp_${uuidv4()}`,
    workflow_id: workflow.id,
    workflow_name: workflow.name,
    start_time: startTime,
    end_time: new Date().toISOString(),
    duration: durationMs,
    status,
    total_nodes: workflow.nodes.length,
    success_count: successCount,
    failed_count: failedCount,
    skipped_count: skippedCount,
    node_results: nodeResults,
  };
};

const createVariableResolver = (resolveEnvVars, runtimeVariables = {}) => (str) => {
  if (!str) return str;
  let resolved = resolveEnvVars(str);
  Object.entries(runtimeVariables).forEach(([k, { value }]) => {
    resolved = resolved.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), value);
  });
  return resolved;
};

const buildContextFromResults = (nodeResults) => {
  const context = {};
  nodeResults.forEach((res) => {
    if (!res.extracted_data || res.status === 'skipped') return;
    // Rust DataMapper expects nodeId.response.body.* paths
    context[res.node_id] = { response: res.extracted_data };
  });
  return context;
};

const stripNodeForBackend = (node) => {
  const { manual_inputs, ...restData } = node.data || {};
  return { ...node, data: restData };
};

const resolveNodeForExecution = (node, resolveVariables, runtimeVariables = {}) => {
  const method = (node.data.method || 'GET').toUpperCase();
  const allowsBody = !['GET', 'HEAD', 'DELETE'].includes(method);
  const stripped = stripNodeForBackend(node);

  const baseNode = {
    ...stripped,
    data: {
      ...stripped.data,
      timeout: typeof node.data.timeout === 'string'
        ? parseInt(resolveVariables(node.data.timeout), 10)
        : node.data.timeout,
    },
  };

  if (node.type !== 'api') return baseNode;

  const runtimeHeaders = [];
  const runtimeParams = [];
  const runtimeBodyEntries = [];

  Object.entries(runtimeVariables).forEach(([key, { value, target }]) => {
    let effectiveTarget = target || 'variable';
    if (effectiveTarget === 'body' && !allowsBody) effectiveTarget = 'params';

    if (effectiveTarget === 'header') {
      runtimeHeaders.push({ id: `runtime_${key}`, key, value, enabled: true });
    } else if (effectiveTarget === 'params') {
      runtimeParams.push({ id: `runtime_${key}`, key, value, enabled: true });
    } else if (effectiveTarget === 'body') {
      runtimeBodyEntries.push([key, { value, target: effectiveTarget }]);
    }
  });

  const mergedHeaders = [
    ...(node.data.headers || [])
      .filter((h) => h.enabled !== false && h.key?.trim() && !/^cookie$/i.test(h.key.trim()))
      .map((h) => ({ ...h, value: resolveVariables(h.value) })),
    ...runtimeHeaders,
  ];
  const mergedParams = [
    ...(node.data.params || [])
      .filter((p) => p.enabled !== false && p.key?.trim())
      .map((p) => ({ ...p, value: resolveVariables(p.value) })),
    ...runtimeParams,
  ];

  let body = node.data.body;
  if (runtimeBodyEntries.length > 0) {
    const bodyObj = body
      ? (typeof body === 'string'
        ? (() => { try { return JSON.parse(body); } catch { return {}; } })()
        : { ...body })
      : {};
    runtimeBodyEntries.forEach(([key, { value }]) => { bodyObj[key] = value; });
    body = bodyObj;
  }

  const bodyParamEntries = [];
  let resolvedBody = null;

  if (body && allowsBody) {
    if (typeof body === 'string') {
      resolvedBody = resolveVariables(body);
    } else {
      try {
        resolvedBody = JSON.parse(resolveVariables(JSON.stringify(body)));
      } catch {
        resolvedBody = body;
      }
    }
  } else if (body) {
    // GET/HEAD/DELETE must not send a body — promote JSON fields to query params instead.
    let bodyObj = null;
    if (typeof body === 'string') {
      try {
        bodyObj = JSON.parse(resolveVariables(body));
      } catch {
        bodyObj = null;
      }
    } else if (typeof body === 'object' && !Array.isArray(body)) {
      try {
        bodyObj = JSON.parse(resolveVariables(JSON.stringify(body)));
      } catch {
        bodyObj = body;
      }
    }
    if (bodyObj && typeof bodyObj === 'object' && !Array.isArray(bodyObj)) {
      Object.entries(bodyObj).forEach(([key, value]) => {
        if (key?.trim()) {
          bodyParamEntries.push({
            id: `body_${key}`,
            key,
            value: value == null ? '' : String(value),
            enabled: true,
          });
        }
      });
    }
  }

  return {
    ...baseNode,
    data: {
      ...baseNode.data,
      url: resolveVariables(node.data.url),
      headers: mergedHeaders,
      params: [...mergedParams, ...bodyParamEntries],
      body: resolvedBody,
    },
  };
};

const getWorkflowSnapshot = (wf) => {
  if (!wf) return null;
  return JSON.stringify({
    name: wf.name || '',
    nodes: (wf.nodes || []).map(n => ({
      id: n.id,
      type: n.type,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      data: n.data,
      skipped: n.data?.skipped,
      save_session: n.data?.save_session
    })),
    edges: (wf.edges || []).map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }))
  });
};

export const defaultWorkflow = () => ({
  id: null,
  name: 'Untitled Workflow',
  description: '',
  nodes: [],
  edges: [],
  teamId: null,
  projectId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const useWorkflowStore = create(
  persist(
    (set, get) => ({
      // Current workflow being edited
      currentWorkflow: defaultWorkflow(),
      
      // Execution state
      isExecuting: false,
      isPaused: false,
      executingNodeIds: new Set(),
      executionResult: null,
      executionProgress: { completed: 0, total: 0, percentage: 0 },
      showConfigPanel: false,
      showResultsLog: false,
      pendingManualInput: null,
      
      // Workflows list
      workflows: [],

      // ─── Workflow Tabs (mirrors requestStore tab pattern) ──────
      openWorkflowTabs: [],
      activeWorkflowTabId: null,
      _workflowTabsById: new Map(),

      // UI state
      selectedNode: null,
      isSaving: false,
      isCreating: false,
      isDeleting: false,
      isLoadingWorkflows: false,
      hasUnsavedChanges: false,
      baseWorkflowSnapshot: null,

      // ─── Workflow Tab Management ──────────────────────────────

      openWorkflowTab: (workflow) => {
        set((state) => {
          const tabId = workflow.id;
          // Already open — just activate it
          if (tabId && state._workflowTabsById.has(tabId)) {
            return {
              activeWorkflowTabId: tabId,
              currentWorkflow: workflow,
              selectedNode: null,
              showConfigPanel: false,
              executionResult: null,
            };
          }
          const newTabId = tabId || uuidv4();
          const newTab = { id: newTabId, workflow };
          const newTabsById = new Map(state._workflowTabsById);
          newTabsById.set(newTabId, newTab);
          return {
            openWorkflowTabs: [...state.openWorkflowTabs, newTab],
            activeWorkflowTabId: newTabId,
            _workflowTabsById: newTabsById,
            currentWorkflow: workflow,
            selectedNode: null,
            showConfigPanel: false,
            executionResult: null,
          };
        });
      },

      closeWorkflowTab: (tabId) => {
        set((state) => {
          const newTabs = state.openWorkflowTabs.filter(t => t.id !== tabId);
          const newTabsById = new Map(state._workflowTabsById);
          newTabsById.delete(tabId);
          const isClosingActive = state.activeWorkflowTabId === tabId;

          if (newTabs.length === 0) {
            return {
              openWorkflowTabs: [],
              activeWorkflowTabId: null,
              currentWorkflow: defaultWorkflow(),
              _workflowTabsById: newTabsById,
            };
          }

          if (isClosingActive) {
            const closingIdx = state.openWorkflowTabs.findIndex(t => t.id === tabId);
            const nextTab = newTabs[closingIdx - 1] || newTabs[0];
            return {
              openWorkflowTabs: newTabs,
              activeWorkflowTabId: nextTab.id,
              currentWorkflow: nextTab.workflow,
              _workflowTabsById: newTabsById,
            };
          }

          return { openWorkflowTabs: newTabs, _workflowTabsById: newTabsById };
        });
      },

      setActiveWorkflowTabId: (tabId) => {
        set((state) => {
          const tab = state._workflowTabsById.get(tabId);
          if (!tab) return state;
          return {
            activeWorkflowTabId: tabId,
            currentWorkflow: tab.workflow,
            selectedNode: null,
          };
        });
      },

      // Sync open tab data when workflow is saved/updated remotely
      syncWorkflowTab: (workflow) => {
        set((state) => {
          if (!state._workflowTabsById.has(workflow.id)) return state;
          const newTabs = state.openWorkflowTabs.map(t =>
            t.id === workflow.id ? { ...t, workflow } : t
          );
          const newTabsById = new Map(state._workflowTabsById);
          newTabsById.set(workflow.id, { id: workflow.id, workflow });
          return {
            openWorkflowTabs: newTabs,
            _workflowTabsById: newTabsById,
            currentWorkflow: state.activeWorkflowTabId === workflow.id ? workflow : state.currentWorkflow,
          };
        });
      },

      // ─── Workflow Management ───────────────────────────────────

      setCurrentWorkflow: (workflow) => {
        set({
          currentWorkflow: workflow || defaultWorkflow(),
          selectedNode: null,
        });
      },

      updateWorkflowField: (field, value) => {
        set((state) => {
          const updatedWorkflow = {
            ...state.currentWorkflow,
            [field]: value,
            updatedAt: new Date().toISOString(),
          };

          // If updating name, sync it with the workflows list for live sidebar updates
          let newWorkflows = state.workflows;
          if (field === 'name') {
            newWorkflows = state.workflows.map((w) =>
              w.id === state.currentWorkflow.id ? { ...w, name: value } : w
            );
          }

          return {
            currentWorkflow: updatedWorkflow,
            workflows: newWorkflows,
            hasUnsavedChanges: getWorkflowSnapshot(updatedWorkflow) !== state.baseWorkflowSnapshot,
          };
        });
      },

      newWorkflow: async (teamId, projectId) => {
        if (!navigator.onLine) {
          toast.error('You are offline. Cannot create workflow.');
          return null;
        }

        set({ isCreating: true });
        const nw = defaultWorkflow();
        nw.teamId = teamId || null;
        nw.projectId = projectId || null;

        try {
          const { data } = await api.post('/api/workflow', nw);
          const createdWorkflow = data.workflow;

          set((state) => ({
            currentWorkflow: createdWorkflow,
            workflows: [createdWorkflow, ...state.workflows],
            selectedNode: null,
            executionResult: null,
            isCreating: false,
            hasUnsavedChanges: false,
            baseWorkflowSnapshot: getWorkflowSnapshot(createdWorkflow),
          }));

          // Emit real-time update
          const { useSocketStore } = await import('@/store/socketStore');
          const { useAuthStore } = await import('@/store/authStore');
          const { useTeamStore } = await import('@/store/teamStore');
          useSocketStore.getState().emitWorkflowCreated(
            useTeamStore.getState().currentTeam?._id,
            createdWorkflow,
            useAuthStore.getState().user?._id
          );

          return createdWorkflow;
        } catch (error) {
          console.error('Failed to create workflow:', error);
          toast.error('Failed to create workflow on server');
          set({ isCreating: false });
          return null;
        }
      },

      setWorkflows: (workflows) => set({ workflows }),

      // ─── Node Management ───────────────────────────────────────

      addNode: (nodeType, position) => {
        const nodeDefaults = {
          api: {
            name: 'API Node',
            method: 'GET',
            url: '',
            headers: [],
            params: [],
            body: null,
            data_mappings: [],
            validations: [],
            timeout: 30,
            retries: 0,
            save_session: false,
            manual_inputs: [],
          },
          delay: {
            name: 'Delay Node',
            timeout: 1000,
            retries: 0,
          },
        };

        const newNode = {
          id: uuidv4(),
          type: nodeType,
          position: position || { x: 100, y: 100 },
          data: nodeDefaults[nodeType] || {
            name: `${nodeType} Node`,
            timeout: 30,
          },
        };

        set((state) => {
          const newNodes = [...state.currentWorkflow.nodes, newNode];
          const updatedWorkflow = {
            ...state.currentWorkflow,
            nodes: calculateLayers(newNodes, state.currentWorkflow.edges),
            updatedAt: new Date().toISOString(),
          };
          return {
            currentWorkflow: updatedWorkflow,
            selectedNode: newNode.id,
            showConfigPanel: true,
            hasUnsavedChanges: getWorkflowSnapshot(updatedWorkflow) !== state.baseWorkflowSnapshot,
          };
        });
      },

      toggleNodeSkip: (nodeId) => {
        set((state) => {
          const updatedWorkflow = {
            ...state.currentWorkflow,
            nodes: state.currentWorkflow.nodes.map((n) =>
              n.id === nodeId
                ? { ...n, data: { ...n.data, skipped: !n.data.skipped } }
                : n
            ),
            updatedAt: new Date().toISOString(),
          };
          return {
            currentWorkflow: updatedWorkflow,
            hasUnsavedChanges: getWorkflowSnapshot(updatedWorkflow) !== state.baseWorkflowSnapshot,
          };
        });
      },

      toggleNodeSession: (nodeId) => {
        set((state) => {
          const updatedWorkflow = {
            ...state.currentWorkflow,
            nodes: state.currentWorkflow.nodes.map((n) =>
              n.id === nodeId
                ? { ...n, data: { ...n.data, save_session: !n.data.save_session } }
                : n
            ),
            updatedAt: new Date().toISOString(),
          };
          return {
            currentWorkflow: updatedWorkflow,
            hasUnsavedChanges: getWorkflowSnapshot(updatedWorkflow) !== state.baseWorkflowSnapshot,
          };
        });
      },

      updateNode: (nodeId, updates) => {
        set((state) => {
          const newNodes = state.currentWorkflow.nodes.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, ...updates } }
              : node
          );
          const updatedWorkflow = {
            ...state.currentWorkflow,
            nodes: newNodes, // Layer doesn't change on data update
            updatedAt: new Date().toISOString(),
          };
          return {
            currentWorkflow: updatedWorkflow,
            hasUnsavedChanges: getWorkflowSnapshot(updatedWorkflow) !== state.baseWorkflowSnapshot,
          };
        });
      },

      // toggleNodeSession (deduplicated — canonical version is above)

      deleteNode: (nodeId) => {
        set((state) => {
          const newNodes = state.currentWorkflow.nodes.filter((n) => n.id !== nodeId);
          const newEdges = state.currentWorkflow.edges.filter(
            (e) => e.source !== nodeId && e.target !== nodeId
          );
          const updatedWorkflow = {
            ...state.currentWorkflow,
            nodes: calculateLayers(newNodes, newEdges),
            edges: newEdges,
            updatedAt: new Date().toISOString(),
          };
          return {
            currentWorkflow: updatedWorkflow,
            selectedNode: state.selectedNode === nodeId ? null : state.selectedNode,
            hasUnsavedChanges: getWorkflowSnapshot(updatedWorkflow) !== state.baseWorkflowSnapshot,
          };
        });
      },

      setSelectedNode: (nodeId) => {
        set({ selectedNode: nodeId, showConfigPanel: !!nodeId });
      },

      // ─── Edge Management ───────────────────────────────────────

      addEdge: (edge) => {
        set((state) => {
          const newEdges = [...state.currentWorkflow.edges, { ...edge, id: uuidv4() }];
          const updatedWorkflow = {
            ...state.currentWorkflow,
            nodes: calculateLayers(state.currentWorkflow.nodes, newEdges),
            edges: newEdges,
            updatedAt: new Date().toISOString(),
          };
          return {
            currentWorkflow: updatedWorkflow,
            hasUnsavedChanges: getWorkflowSnapshot(updatedWorkflow) !== state.baseWorkflowSnapshot,
          };
        });
      },

      deleteEdge: (edgeId) => {
        set((state) => {
          const newEdges = state.currentWorkflow.edges.filter((e) => e.id !== edgeId);
          const updatedWorkflow = {
            ...state.currentWorkflow,
            nodes: calculateLayers(state.currentWorkflow.nodes, newEdges),
            edges: newEdges,
            updatedAt: new Date().toISOString(),
          };
          return {
            currentWorkflow: updatedWorkflow,
            hasUnsavedChanges: getWorkflowSnapshot(updatedWorkflow) !== state.baseWorkflowSnapshot,
          };
        });
      },

      updateEdge: (edgeId, updates) => {
        set((state) => {
          const newEdges = state.currentWorkflow.edges.map((edge) =>
            edge.id === edgeId ? { ...edge, ...updates } : edge
          );
          const updatedWorkflow = {
            ...state.currentWorkflow,
            edges: newEdges,
            updatedAt: new Date().toISOString(),
          };
          return {
            currentWorkflow: updatedWorkflow,
            hasUnsavedChanges: getWorkflowSnapshot(updatedWorkflow) !== state.baseWorkflowSnapshot,
          };
        });
      },

      setNodes: (nodes, markDirty = true) => {
        set((state) => {
          const updatedWorkflow = {
            ...state.currentWorkflow,
            nodes: calculateLayers(nodes, state.currentWorkflow.edges),
            updatedAt: new Date().toISOString(),
          };
          return {
            currentWorkflow: updatedWorkflow,
            ...(markDirty ? { hasUnsavedChanges: getWorkflowSnapshot(updatedWorkflow) !== state.baseWorkflowSnapshot } : {}),
          };
        });
      },

      setEdges: (edges, markDirty = true) => {
        set((state) => {
          const updatedWorkflow = {
            ...state.currentWorkflow,
            nodes: calculateLayers(state.currentWorkflow.nodes, edges),
            edges,
            updatedAt: new Date().toISOString(),
          };
          return {
            currentWorkflow: updatedWorkflow,
            ...(markDirty ? { hasUnsavedChanges: getWorkflowSnapshot(updatedWorkflow) !== state.baseWorkflowSnapshot } : {}),
          };
        });
      },

      // ─── Execution ─────────────────────────────────────────────

      submitManualInput: (runtimeValues) => {
        const pending = get().pendingManualInput;
        if (!pending) return;
        pending.resolve(runtimeValues);
        set({ pendingManualInput: null });
      },

      cancelManualInput: () => {
        const pending = get().pendingManualInput;
        if (pending) pending.reject(new Error('Manual input cancelled'));
        set({ pendingManualInput: null, isExecuting: false, executingNodeIds: new Set() });
      },

      waitForManualInput: (node) =>
        new Promise((resolve, reject) => {
          set({ pendingManualInput: { node, resolve, reject } });
          // Ensure React paints the modal before the async loop continues waiting
          requestAnimationFrame(() => {});
        }),

      executeWorkflowInteractive: async () => {
        const workflow = { ...get().currentWorkflow };
        if (!workflow.id) workflow.id = `temp_${uuidv4()}`;

        if (workflow.nodes.length === 0) {
          toast.error('Workflow must contain at least one node');
          return;
        }

        const { resolveVariables: resolveEnvVars } = (await import('./environmentStore')).useEnvironmentStore.getState();
        const executionStart = Date.now();
        const startTime = new Date().toISOString();

        const clearedNodes = workflow.nodes.map((n) => ({
          ...n,
          data: { ...n.data, executionStatus: null, executionDuration: null },
        }));

        set({
          isExecuting: true,
          isPaused: false,
          executingNodeIds: new Set(),
          executionResult: null,
          currentWorkflow: { ...workflow, nodes: clearedNodes },
          executionProgress: { completed: 0, total: workflow.nodes.length, percentage: 0 },
        });

        const sortedNodes = [...workflow.nodes].sort(
          (a, b) => (a.data.step || 0) - (b.data.step || 0)
        );
        const nodeResults = [];
        let context = {};

        try {
          for (const node of sortedNodes) {
            if (!isNodeSatisfied(node.id, workflow.edges, nodeResults)) {
              nodeResults.push(buildSkippedResult(node));
              continue;
            }

            if (node.data.skipped) {
              nodeResults.push(buildSkippedResult(node));
              continue;
            }

            set({ executingNodeIds: new Set([node.id]) });

            let runtimeVariables = {};
            if (node.type === 'api' && (node.data.manual_inputs?.length ?? 0) > 0) {
              runtimeVariables = await get().waitForManualInput(node);
            }

            const resolveVariables = createVariableResolver(resolveEnvVars, runtimeVariables);
            const resolvedNode = resolveNodeForExecution(node, resolveVariables, runtimeVariables);

            const result = await invoke('execute_single_node', {
              nodeJson: JSON.stringify(resolvedNode),
              contextJson: JSON.stringify(context),
            });

            nodeResults.push(result);
            if (result.extracted_data && result.status !== 'skipped') {
              context = {
                ...context,
                [result.node_id]: { response: result.extracted_data },
              };
            }

            const completed = nodeResults.length;
            set({
              executionProgress: {
                completed,
                total: workflow.nodes.length,
                percentage: Math.round((completed / workflow.nodes.length) * 100),
              },
              executionResult: buildExecutionSummary(
                nodeResults,
                workflow,
                Date.now() - executionStart,
                startTime
              ),
              currentWorkflow: {
                ...get().currentWorkflow,
                nodes: get().currentWorkflow.nodes.map((n) => {
                  const nr = nodeResults.find((r) => r.node_id === n.id);
                  if (!nr) return n;
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      executionStatus: nr.status,
                      executionDuration: nr.duration,
                    },
                  };
                }),
              },
            });
          }

          const result = buildExecutionSummary(
            nodeResults,
            workflow,
            Date.now() - executionStart,
            startTime
          );

          set({ executionResult: result, isExecuting: false, executingNodeIds: new Set() });

          if (result.status === 'success') {
            toast.success(`Workflow completed successfully! ${result.success_count}/${result.total_nodes} nodes passed`);
          } else if (result.status === 'partial') {
            toast.error(`Workflow partially completed. ${result.failed_count} nodes failed`);
          } else {
            toast.error('Workflow execution failed');
          }

          queueMicrotask(async () => {
            try {
              const { writeWorkflowTestSheet } = await import('@/utils/workflowTestReport');
              const exported = writeWorkflowTestSheet(result, workflow.name);
              if (exported.ok) {
                toast.success(`Test sheet generated: ${exported.fileName}`);
              } else if (exported.reason === 'no_api_nodes') {
                toast('This run had no API nodes to include in the Excel test sheet.', { icon: 'ℹ️' });
              } else if (exported.reason === 'error') {
                toast.error(exported.message || 'Could not generate test sheet');
              }
            } catch (e) {
              console.error('[executeWorkflowInteractive] test sheet:', e);
            }
          });

          if (navigator.onLine && workflow.id) {
            await get().saveExecution(result);
          }

          return result;
        } catch (error) {
          const msg = error?.message || String(error);
          if (msg === 'Manual input cancelled') {
            toast.error('Workflow cancelled');
          } else {
            console.error('Interactive workflow execution error:', error);
            toast.error(`Execution failed: ${msg}`);
          }
          set({ isExecuting: false, executingNodeIds: new Set(), pendingManualInput: null });
          throw error;
        }
      },

      // Always use the interactive per-node path so release builds match dev:
      // correct GET/HEAD/DELETE body handling, manual input modals, and env resolution.
      executeWorkflow: async () => get().executeWorkflowInteractive(),

      updateExecutionProgress: (progress) => {
        set({ executionProgress: progress });
      },

      executeSingleNode: async (nodeId) => {
        const workflow = { ...get().currentWorkflow };
        const node = workflow.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const { resolveVariables: resolveEnvVars } = (await import('./environmentStore')).useEnvironmentStore.getState();

        set({ executingNodeIds: new Set([nodeId]) });

        try {
          let runtimeVariables = {};
          if (node.type === 'api' && (node.data.manual_inputs?.length ?? 0) > 0) {
            runtimeVariables = await get().waitForManualInput(node);
          }

          const resolveVariables = createVariableResolver(resolveEnvVars, runtimeVariables);
          const resolvedNode = resolveNodeForExecution(node, resolveVariables, runtimeVariables);

          const context = buildContextFromResults(get().executionResult?.node_results || []);

          const result = await invoke('execute_single_node', {
            nodeJson: JSON.stringify(resolvedNode),
            contextJson: JSON.stringify(context)
          });

          // Update execution result — O(n) single pass, no double filter
          set((state) => {
            const prev = state.executionResult;
            const nodeResults = prev ? [...prev.node_results] : [];

            const existingIdx = nodeResults.findIndex((r) => r.node_id === nodeId);
            if (existingIdx >= 0) {
              nodeResults[existingIdx] = result;
            } else {
              nodeResults.push(result);
            }

            // Single-pass accumulator — O(n) instead of two O(n) filter passes
            let successCount = 0, failedCount = 0, skippedCount = 0;
            for (const r of nodeResults) {
              if (r.status === 'success') successCount++;
              else if (r.status === 'failed') failedCount++;
              else if (r.status === 'skipped') skippedCount++;
            }

            const newResult = {
              ...(prev ?? {
                id: `temp_${uuidv4()}`,
                status: 'partial',
                total_nodes: workflow.nodes.length,
                duration: 0,
              }),
              node_results: nodeResults,
              success_count: successCount,
              failed_count: failedCount,
              skipped_count: skippedCount,
            };

            return { executingNodeIds: new Set(), executionResult: newResult };
          });

          if (result.status === 'success') {
            toast.success(`Node executed successfully`);
          } else {
            toast.error(`Node execution failed`);
          }

          return result;
        } catch (error) {
          const msg = error?.message || String(error);
          if (msg === 'Manual input cancelled') {
            toast.error('Execution cancelled');
          } else {
            console.error('Node execution error:', error);
            toast.error(`Execution failed: ${msg}`);
          }
          set({ executingNodeIds: new Set(), pendingManualInput: null });
          throw error;
        }
      },

      cancelExecution: async () => {
        try {
          await invoke('cancel_workflow_execution');
          set({ isExecuting: false, isPaused: false, executingNodeIds: new Set() });
          toast.success('Execution cancelled');
        } catch (error) {
          console.error('Failed to cancel execution:', error);
        }
      },

      pauseExecution: async () => {
        try {
          await invoke('pause_workflow_execution');
          set({ isPaused: true });
          toast.success('Execution paused');
        } catch (error) {
          console.error('Failed to pause execution:', error);
          toast.error('Failed to pause execution');
        }
      },

      resumeExecution: async () => {
        try {
          await invoke('resume_workflow_execution');
          set({ isPaused: false });
          toast.success('Execution resumed');
        } catch (error) {
          console.error('Failed to resume execution:', error);
          toast.error('Failed to resume execution');
        }
      },

      // ─── Backend Integration ───────────────────────────────────

      saveWorkflow: async () => {
        const workflow = get().currentWorkflow;

        if (!navigator.onLine) {
          toast.error('You are offline. Cannot save workflow.');
          return { success: false };
        }

        set({ isSaving: true });
        try {
          if (workflow.id) {
            try {
              // Update existing
              const { data } = await api.put(`/api/workflow/${workflow.id}`, workflow);
              set((state) => ({
                currentWorkflow: data.workflow,
                workflows: state.workflows.map((w) => (w.id === workflow.id ? data.workflow : w)),
                isSaving: false,
                hasUnsavedChanges: false,
                baseWorkflowSnapshot: getWorkflowSnapshot(data.workflow),
              }));

              // Emit real-time update
              const { useSocketStore } = await import('@/store/socketStore');
              const { useAuthStore } = await import('@/store/authStore');
              const { useTeamStore } = await import('@/store/teamStore');
              useSocketStore.getState().emitWorkflowUpdated(
                useTeamStore.getState().currentTeam?._id,
                data.workflow,
                useAuthStore.getState().user?._id
              );

              toast.success('Workflow saved');
              return { success: true, workflow: data.workflow };
            } catch (putError) {
              // If PUT fails with 404, the workflow might have been deleted or we're in a new DB
              if (putError.response?.status === 404) {
                console.log('Workflow not found for update, attempting to create new...');
                const { data } = await api.post('/api/workflow', workflow);
                set((state) => ({
                  currentWorkflow: data.workflow,
                  workflows: state.workflows.map((w) => (w.id === workflow.id ? data.workflow : w)),
                  isSaving: false,
                  hasUnsavedChanges: false,
                  baseWorkflowSnapshot: getWorkflowSnapshot(data.workflow),
                }));
                toast.success('Workflow saved (as new)');
                return { success: true, workflow: data.workflow };
              }
              throw putError;
            }
          } else {
            // Create new
            const { data } = await api.post('/api/workflow', workflow);
            set((state) => ({
              currentWorkflow: data.workflow,
              workflows: state.workflows.map((w) => (w.id === workflow.id ? data.workflow : w)),
              isSaving: false,
              hasUnsavedChanges: false,
              baseWorkflowSnapshot: getWorkflowSnapshot(data.workflow),
            }));
            
            // Emit real-time update
            const { useSocketStore } = await import('@/store/socketStore');
            const { useAuthStore } = await import('@/store/authStore');
            const { useTeamStore } = await import('@/store/teamStore');
            useSocketStore.getState().emitWorkflowCreated(
              useTeamStore.getState().currentTeam?._id,
              data.workflow,
              useAuthStore.getState().user?._id
            );

            toast.success('Workflow created');
            return { success: true, workflow: data.workflow };
          }
        } catch (error) {
          console.error('Failed to save workflow:', error);
          toast.error(`Failed to save: ${error.response?.data?.error || error.message}`);
          set({ isSaving: false });
          return { success: false, error };
        }
      },

      fetchWorkflows: async (teamId, projectId) => {
        if (!navigator.onLine) return;

        set({ isLoadingWorkflows: true });
        try {
          const params = new URLSearchParams();
          if (teamId) params.append('teamId', teamId);
          if (projectId) params.append('projectId', projectId);

          const { data } = await api.get(`/api/workflow?${params.toString()}`);
          set({ workflows: data.workflows || [], isLoadingWorkflows: false });
        } catch (error) {
          console.error('Failed to fetch workflows:', error);
          set({ isLoadingWorkflows: false });
        }
      },

      deleteWorkflow: async (workflowId) => {
        if (!navigator.onLine) {
          toast.error('You are offline. Cannot delete workflow.');
          return { success: false };
        }

        set({ isDeleting: true });
        try {
          await api.delete(`/api/workflow/${workflowId}`);
          set((state) => ({
            workflows: state.workflows.filter((w) => w.id !== workflowId),
            isDeleting: false,
          }));

          // Emit real-time update
          const { useSocketStore } = await import('@/store/socketStore');
          const { useAuthStore } = await import('@/store/authStore');
          const { useTeamStore } = await import('@/store/teamStore');
          useSocketStore.getState().emitWorkflowDeleted(
            useTeamStore.getState().currentTeam?._id,
            workflowId,
            useAuthStore.getState().user?._id
          );

          toast.success('Workflow deleted');
          return { success: true };
        } catch (error) {
          if (error.response?.status === 404) {
            set((state) => ({
              workflows: state.workflows.filter((w) => w.id !== workflowId),
              isDeleting: false,
            }));
            toast.success('Workflow deleted (locally)');
            return { success: true };
          }
          console.error('Failed to delete workflow:', error);
          toast.error('Failed to delete workflow');
          set({ isDeleting: false });
          return { success: false, error };
        }
      },

      saveExecution: async (executionResult) => {
        try {
          const { activeEnvironment } = (await import('./environmentStore')).useEnvironmentStore.getState();
          const workflow = get().currentWorkflow;

          await api.post('/api/workflow-execution', {
            ...executionResult,
            teamId: workflow.teamId,
            environmentId: activeEnvironment?._id || null,
            environmentName: activeEnvironment?.name || 'No Environment'
          });
        } catch (error) {
          console.error('Failed to save execution:', error);
        }
      },

      openWorkflow: (workflow) => {
        // openWorkflow still sets currentWorkflow (used by WorkflowCanvas)
        // The tab is opened separately via openWorkflowTab from the sidebar
        set({
          currentWorkflow: workflow,
          selectedNode: null,
          showConfigPanel: false,
          isExecuting: false,
          executionResult: null,
          hasUnsavedChanges: false,
          baseWorkflowSnapshot: getWorkflowSnapshot(workflow),
        });
      },

      // ─── Reset ─────────────────────────────────────────────────

      reset: () => {
        set({
          currentWorkflow: defaultWorkflow(),
          isExecuting: false,
          executionResult: null,
          selectedNode: null,
          showConfigPanel: false,
        });
      },
    }),
    {
      name: 'payloadx-workflow',
      // Only persist the current workflow canvas — NOT the list.
      // The list is always fetched fresh from the server on load.
      // Persisting it caused deleted/renamed workflows to "come back"
      // because the stale localStorage copy would overwrite fresh state.
      // _workflowTabsById is a Map — cannot be serialized by Zustand persist.
      partialize: (state) => ({
        currentWorkflow: state.currentWorkflow,
      }),
    }
  )
);
