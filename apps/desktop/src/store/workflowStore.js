import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import api from '@/lib/api';
import { invoke } from '@tauri-apps/api/tauri';
import toast from 'react-hot-toast';
import { calculateLayers, deepClone } from '@/utils/perf';

// calculateLayers is imported from @/utils/perf (memoized BFS)

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
      
      // Workflows list
      workflows: [],
      
      // UI state
      selectedNode: null,
      isSaving: false,
      isCreating: false,
      isDeleting: false,
      isLoadingWorkflows: false,

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
        const newNode = {
          id: uuidv4(),
          type: nodeType,
          position: position || { x: 100, y: 100 },
          data: {
            name: `${nodeType} Node`,
            method: nodeType === 'api' ? 'GET' : undefined,
            url: nodeType === 'api' ? '' : undefined,
            headers: [],
            params: [],
            body: null,
            data_mappings: [],
            validations: [],
            timeout: 30,
            retries: 0,
            save_session: false,
          },
        };

        set((state) => {
          const newNodes = [...state.currentWorkflow.nodes, newNode];
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              nodes: calculateLayers(newNodes, state.currentWorkflow.edges),
              updatedAt: new Date().toISOString(),
            },
            selectedNode: newNode.id,
            showConfigPanel: true,
          };
        });
      },

      toggleNodeSkip: (nodeId) => {
        set((state) => ({
          currentWorkflow: {
            ...state.currentWorkflow,
            nodes: state.currentWorkflow.nodes.map((n) =>
              n.id === nodeId
                ? { ...n, data: { ...n.data, skipped: !n.data.skipped } }
                : n
            ),
            updatedAt: new Date().toISOString(),
          },
        }));
      },

      toggleNodeSession: (nodeId) => {
        set((state) => ({
          currentWorkflow: {
            ...state.currentWorkflow,
            nodes: state.currentWorkflow.nodes.map((n) =>
              n.id === nodeId
                ? { ...n, data: { ...n.data, save_session: !n.data.save_session } }
                : n
            ),
            updatedAt: new Date().toISOString(),
          },
        }));
      },

      updateNode: (nodeId, updates) => {
        set((state) => {
          const newNodes = state.currentWorkflow.nodes.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, ...updates } }
              : node
          );
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              nodes: newNodes, // Layer doesn't change on data update
              updatedAt: new Date().toISOString(),
            },
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
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              nodes: calculateLayers(newNodes, newEdges),
              edges: newEdges,
              updatedAt: new Date().toISOString(),
            },
            selectedNode: state.selectedNode === nodeId ? null : state.selectedNode,
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
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              nodes: calculateLayers(state.currentWorkflow.nodes, newEdges),
              edges: newEdges,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      deleteEdge: (edgeId) => {
        set((state) => {
          const newEdges = state.currentWorkflow.edges.filter((e) => e.id !== edgeId);
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              nodes: calculateLayers(state.currentWorkflow.nodes, newEdges),
              edges: newEdges,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      updateEdge: (edgeId, updates) => {
        set((state) => {
          const newEdges = state.currentWorkflow.edges.map((edge) =>
            edge.id === edgeId ? { ...edge, ...updates } : edge
          );
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              edges: newEdges,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      setNodes: (nodes) => {
        set((state) => ({
          currentWorkflow: {
            ...state.currentWorkflow,
            nodes: calculateLayers(nodes, state.currentWorkflow.edges),
            updatedAt: new Date().toISOString(),
          },
        }));
      },

      setEdges: (edges) => {
        set((state) => ({
          currentWorkflow: {
            ...state.currentWorkflow,
            nodes: calculateLayers(state.currentWorkflow.nodes, edges),
            edges,
            updatedAt: new Date().toISOString(),
          },
        }));
      },

      // ─── Execution ─────────────────────────────────────────────

      executeWorkflow: async () => {
        const workflow = { ...get().currentWorkflow };
        
        // Backend expects id to be a string, not null
        if (!workflow.id) {
          workflow.id = `temp_${uuidv4()}`;
        }
        
        const { resolveVariables } = (await import('./environmentStore')).useEnvironmentStore.getState();

        if (workflow.nodes.length === 0) {
          toast.error('Workflow must contain at least one node');
          return;
        }

        // Clear previous results and set loading state
        const clearedNodes = workflow.nodes.map(n => ({
          ...n,
          data: { ...n.data, executionStatus: null, executionDuration: null }
        }));

        set({ 
          isExecuting: true, 
          isPaused: false,
          executingNodeIds: new Set(),
          executionResult: null, 
          currentWorkflow: { ...workflow, nodes: clearedNodes },
          executionProgress: { completed: 0, total: workflow.nodes.length, percentage: 0 } 
        });

        try {
          // Pre-resolve environment variables and map to snake_case for Rust
          const resolvedNodes = workflow.nodes.map(node => {
            const baseNode = {
              ...node,
              data: {
                ...node.data,
                timeout: typeof node.data.timeout === 'string' 
                  ? parseInt(resolveVariables(node.data.timeout)) 
                  : node.data.timeout
              }
            };

            if (node.type === 'api') {
              return {
                ...baseNode,
                data: {
                  ...baseNode.data,
                  url: resolveVariables(node.data.url),
                  headers: (node.data.headers || []).map(h => ({
                    ...h,
                    value: resolveVariables(h.value)
                  })),
                  body: node.data.body ? (
                    typeof node.data.body === 'string' 
                      ? resolveVariables(node.data.body) 
                      : JSON.parse(resolveVariables(JSON.stringify(node.data.body)))
                  ) : null
                }
              };
            }
            return baseNode;
          });

          const resolvedWorkflow = {
            ...workflow,
            nodes: resolvedNodes,
            created_at: workflow.createdAt || new Date().toISOString(),
            updated_at: workflow.updatedAt || new Date().toISOString(),
            project_id: workflow.projectId || '',
            team_id: workflow.teamId || '',
          };

          const result = await invoke('execute_workflow', {
            workflowJson: JSON.stringify(resolvedWorkflow),
          });

          set({ executionResult: result, isExecuting: false, executingNodeIds: new Set() });
          
          if (result.status === 'success') {
            toast.success(`Workflow completed successfully! ${result.success_count}/${result.total_nodes} nodes passed`);
          } else if (result.status === 'partial') {
            toast.error(`Workflow partially completed. ${result.failed_count} nodes failed`);
          } else {
            toast.error('Workflow execution failed');
          }

          // Save execution to backend
          if (navigator.onLine && workflow.id) {
            await get().saveExecution(result);
          }

          return result;
        } catch (error) {
          console.error('Workflow execution error:', error);
          toast.error(`Execution failed: ${error}`);
          set({ isExecuting: false, executingNodeIds: new Set() });
          throw error;
        }
      },

      updateExecutionProgress: (progress) => {
        set({ executionProgress: progress });
      },

      executeSingleNode: async (nodeId) => {
        const workflow = { ...get().currentWorkflow };
        const node = workflow.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const { resolveVariables } = (await import('./environmentStore')).useEnvironmentStore.getState();

        set({ executingNodeIds: new Set([nodeId]) });

        try {
          // Pre-resolve environment variables just for this node
          const resolvedNode = {
            ...node,
            data: {
              ...node.data,
              timeout: typeof node.data.timeout === 'string' 
                ? parseInt(resolveVariables(node.data.timeout)) 
                : node.data.timeout
            }
          };

          if (node.type === 'api') {
            resolvedNode.data = {
              ...resolvedNode.data,
              url: resolveVariables(node.data.url),
              headers: (node.data.headers || []).map(h => ({
                ...h,
                value: resolveVariables(h.value)
              })),
              body: node.data.body ? (
                typeof node.data.body === 'string' 
                  ? resolveVariables(node.data.body) 
                  : JSON.parse(resolveVariables(JSON.stringify(node.data.body)))
              ) : null
            };
          }

          // Build context from current executionResult (if any)
          const context = {};
          const currentExecResult = get().executionResult;
          if (currentExecResult && currentExecResult.node_results) {
             currentExecResult.node_results.forEach(res => {
               if (res.extracted_data) {
                 context[res.node_id] = res.extracted_data;
               }
             });
          }

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
          console.error('Node execution error:', error);
          toast.error(`Execution failed: ${error}`);
          set({ executingNodeIds: new Set() });
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
        set({
          currentWorkflow: workflow,
          selectedNode: null,
          showConfigPanel: false,
          isExecuting: false,
          executionResult: null,
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
      partialize: (state) => ({
        currentWorkflow: state.currentWorkflow,
      }),
    }
  )
);
