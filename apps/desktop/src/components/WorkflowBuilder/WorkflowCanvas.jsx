import { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useWorkflowStore } from '@/store/workflowStore';
import { useProjectStore } from '@/store/projectStore';
import { useTeamStore } from '@/store/teamStore';
import ApiNode from './nodes/ApiNode';
import DelayNode from './nodes/DelayNode';
import { 
  Plus, Play, Save, Loader2, Trash2, ShieldCheck, 
  ShieldOff, MoreVertical, RefreshCw, Square, Pause 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { listen } from '@tauri-apps/api/event';
import { confirm } from '@tauri-apps/api/dialog';
import * as XLSX from 'xlsx';

const nodeTypes = {
  api: ApiNode,
  delay: DelayNode,
};

function WorkflowCanvasInner() {
  const {
    currentWorkflow,
    addNode,
    addEdge: addWorkflowEdge,
    setSelectedNode,
    executionResult,
    isExecuting,
    executeWorkflow,
    saveWorkflow,
    updateWorkflowField,
    setNodes: updateStoreNodes,
    setEdges: updateStoreEdges,
    deleteNode: deleteWorkflowNode,
    deleteEdge: deleteWorkflowEdge,
    updateEdge: updateWorkflowEdge,
    toggleNodeSkip,
    toggleNodeSession,
    isSaving,
    isLoadingWorkflows,
    fetchWorkflows,
    cancelExecution,
    isPaused,
    pauseExecution,
    resumeExecution,
  } = useWorkflowStore();

  const [nodes, setNodes] = useNodesState(currentWorkflow.nodes);
  const [edges, setEdges] = useEdgesState(currentWorkflow.edges);
  const [menu, setMenu] = useState(null);
  const [edgeMenu, setEdgeMenu] = useState(null);
  const { showResultsLog } = useWorkflowStore();
  const { currentProject } = useProjectStore();
  const { currentTeam } = useTeamStore();
  const isInternalUpdate = useRef(false);

  const onNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges]
  );

  // Sync Local -> Store (Debounced or triggered on change)
  useEffect(() => {
    if (isInternalUpdate.current) return;
    updateStoreNodes(nodes);
  }, [nodes, updateStoreNodes]);

  useEffect(() => {
    if (isInternalUpdate.current) return;
    updateStoreEdges(edges);
  }, [edges, updateStoreEdges]);

  // Sync Store -> Local (Only when store actually changes externally)
  useEffect(() => {
    isInternalUpdate.current = true;
    setNodes(currentWorkflow.nodes);
    setEdges(currentWorkflow.edges);
    // Use a small timeout to reset the flag after the render cycle
    const timeout = setTimeout(() => {
      isInternalUpdate.current = false;
    }, 0);

    return () => clearTimeout(timeout);
  }, [currentWorkflow.nodes, currentWorkflow.edges, setNodes, setEdges]);

  // Handle execution events
  useEffect(() => {
    let unlistenProgress;
    let unlistenLayerStart;
    let unlistenLayerFinish;

    const setup = async () => {
      unlistenProgress = await listen('workflow_progress', (event) => {
        useWorkflowStore.getState().updateExecutionProgress(event.payload);
      });

      // When a parallel layer starts, mark ALL nodes in that layer as executing
      unlistenLayerStart = await listen('layer_execution_started', (event) => {
        const nodeIds = event.payload; // string[]
        useWorkflowStore.setState({ executingNodeIds: new Set(nodeIds) });
      });

      // When a layer finishes, clear the executing set
      unlistenLayerFinish = await listen('layer_execution_finished', () => {
        useWorkflowStore.setState({ executingNodeIds: new Set() });
      });

      // Internal debugging logs
      await listen('workflow_log', (event) => {
        const { type, node_name, ...details } = event.payload;
        const color = type === 'request' ? '#3b82f6' : '#10b981';
        console.log(
          `%c[Workflow ${type.toUpperCase()}] %c${node_name}`,
          `color: ${color}; font-weight: bold;`,
          'color: inherit; font-weight: bold;',
          details
        );
      });
    };

    setup();

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenLayerStart) unlistenLayerStart();
      if (unlistenLayerFinish) unlistenLayerFinish();
    };
  }, []);

  const onConnect = useCallback(
    (params) => {
      const { sourceHandle } = params;
      let condition = 'always';
      
      if (sourceHandle === 'success') condition = 'success';
      if (sourceHandle === 'failure') condition = 'failure';

      const newEdge = {
        ...params,
        condition,
        type: 'smoothstep',
        animated: condition !== 'always',
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
      addWorkflowEdge(newEdge);
    },
    [setEdges, addWorkflowEdge]
  );

  const onNodeClick = useCallback(
    (event, node) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setMenu(null);
    setEdgeMenu(null);
  }, [setSelectedNode]);

  const onNodeContextMenu = useCallback(
    (event, node) => {
      event.preventDefault();
      setMenu({
        id: node.id,
        type: node.type,
        top: event.clientY,
        left: event.clientX,
        data: node.data,
      });
    },
    [setMenu]
  );

  const onEdgeContextMenu = useCallback(
    (event, edge) => {
      event.preventDefault();
      setEdgeMenu({
        id: edge.id,
        top: event.clientY,
        left: event.clientX,
        condition: edge.condition || 'always',
      });
    },
    [setEdgeMenu]
  );

  const edgesWithConditions = edges.map((edge) => {
    let color = 'var(--border-2)';
    let label = null;
    let labelBgColor = 'transparent';
    let labelStyle = { fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' };

    if (edge.condition === 'success') {
      color = '#10b981';
      label = 'Success';
      labelBgColor = 'rgba(16, 185, 129, 0.1)';
    } else if (edge.condition === 'failure') {
      color = '#ef4444';
      label = 'Failure';
      labelBgColor = 'rgba(239, 68, 68, 0.1)';
    }

    return {
      ...edge,
      label,
      labelStyle: { ...labelStyle, fill: color },
      labelBgPadding: [4, 4],
      labelBgBorderRadius: 4,
      labelBgStyle: { fill: labelBgColor, stroke: color, strokeWidth: 0.5 },
      style: { ...edge.style, stroke: color, strokeWidth: edge.condition && edge.condition !== 'always' ? 2 : 1.5 },
      animated: (edge.condition && edge.condition !== 'always') ? true : edge.animated,
    };
  });

  const nodesWithStatus = nodes.map((node) => {
    if (!executionResult) return node;

    const result = executionResult.node_results?.find((r) => r.node_id === node.id);
    if (!result) return node;

    return {
      ...node,
      data: {
        ...node.data,
        executionStatus: result.status,
        executionDuration: result.duration,
      },
    };
  });

  const handleExecute = async () => {
    if (currentWorkflow.nodes.length === 0) {
      toast.error('Add at least one node to execute');
      return;
    }
    await executeWorkflow();
  };

  const handleSave = async () => {
    if (!currentProject?._id) {
      toast.error('Please select a project before saving');
      return;
    }

    // Ensure metadata is set
    updateWorkflowField('projectId', currentProject._id);
    if (currentTeam?._id) {
      updateWorkflowField('teamId', currentTeam._id);
    }

    await saveWorkflow();
  };

  const handleRefresh = async () => {
    if (currentTeam?._id) {
      await fetchWorkflows(currentTeam._id, currentProject?._id);
      toast.success('Workflows refreshed');
    }
  };

  const handleExportExcel = () => {
    if (!executionResult || !executionResult.node_results) {
      toast.error('No execution results to export');
      return;
    }

    try {
      // Filter out delay nodes and map results
      const data = executionResult.node_results
        .filter(res => res.request) // Only include nodes with request data (API nodes)
        .map(res => {
          // Collect validation errors if any
          const validationErrors = (res.validations || [])
            .filter(v => !v.passed)
            .map(v => v.message || `${v.type} check failed`)
            .join('; ');

          const executionError = res.error?.message || '';
          const combinedError = [executionError, validationErrors].filter(Boolean).join(' | ');

          return {
            'Node Name': res.node_name,
            'Method': res.request?.method || 'N/A',
            'Status': res.status.toUpperCase(),
            'HTTP Status': res.response?.status || 'N/A',
            'Duration (ms)': res.duration,
            'URL': res.request?.url || 'N/A',
            'Payload': res.request?.body ? JSON.stringify(res.request.body, null, 2) : 'No Body',
            'Error': combinedError || (res.status === 'FAILED' ? 'Unknown Failure' : ''),
            'Execution Time': new Date(res.start_time).toLocaleString(),
          };
        });

      if (data.length === 0) {
        toast.error('No API nodes to export');
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Test Results");

      // Set column widths for a more detailed report
      const wscols = [
        { wch: 25 }, // Node Name
        { wch: 10 }, // Method
        { wch: 12 }, // Status
        { wch: 12 }, // HTTP Status
        { wch: 15 }, // Duration
        { wch: 40 }, // URL
        { wch: 50 }, // Payload
        { wch: 30 }, // Error
        { wch: 20 }, // Execution Time
      ];
      worksheet['!cols'] = wscols;

      const fileName = `SyncNest_Report_${currentWorkflow.name.replace(/\s+/g, '_')}_${new Date().getTime()}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success('Report generated successfully');
    } catch (error) {
      console.error('Failed to generate Excel report:', error);
      toast.error('Failed to generate report');
    }
  };

  const reactFlowInstance = useReactFlow();
  const reactFlowWrapper = useRef(null);

  // Handle adding node at specific position
  const handleAddNode = useCallback((nodeType) => {
    const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();

    // Calculate center position of the viewport
    const centerX = reactFlowBounds ? reactFlowBounds.width / 2 : 250;
    const centerY = reactFlowBounds ? reactFlowBounds.height / 2 : 250;

    // Convert screen coordinates to flow coordinates
    const position = reactFlowInstance.project({
      x: centerX,
      y: centerY,
    });

    addNode(nodeType, position);
  }, [reactFlowInstance, addNode]);

  // Handle drop from sidebar
  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');
      let rawData = event.dataTransfer.getData('application/json');

      // Fallback chain for maximum compatibility (Windows/Mac/Linux)
      if (!rawData) {
        rawData = event.dataTransfer.getData('text/plain') || event.dataTransfer.getData('text');
      }

      if (!type && !rawData) return;

      const position = reactFlowInstance.project({
        x: event.clientX - (reactFlowBounds?.left || 0),
        y: event.clientY - (reactFlowBounds?.top || 0),
      });

      // CASE 1: Dropped an API request object (from sidebar)
      if (rawData) {
        try {
          const request = JSON.parse(rawData);

          // If it's a valid request object, create an API node
          if (request.method || request.protocol || request._id) {
            let parsedBody = null;
            if (request.body?.raw) {
              try {
                parsedBody = JSON.parse(request.body.raw);
              } catch (e) {
                parsedBody = request.body.raw;
              }
            } else if (request.body && typeof request.body !== 'object') {
              // Handle cases where body might already be a string or different format
              parsedBody = request.body;
            } else if (request.body) {
              parsedBody = request.body;
            }

            const newNode = {
              id: uuidv4(),
              type: 'api',
              position,
              data: {
                name: request.name || 'API Request',
                method: request.method || 'GET',
                url: request.url || '',
                headers: request.headers || [],
                params: request.params || [],
                body: parsedBody,
                data_mappings: [],
                validations: [],
                timeout: 30,
                retries: 0,
                save_session: false,
              },
            };

            // Update both local and store state for immediate feedback
            setNodes((nds) => [...nds, newNode]);
            updateStoreNodes([...currentWorkflow.nodes, newNode]);
            setSelectedNode(newNode.id);

            toast.success(`Added ${request.name} to workflow`);
            return;
          }
        } catch (error) {
          // If parsing fails, it might just be a simple type drop (handled below)
          console.error('Failed to parse dropped data:', error);
        }
      }

      // CASE 2: Dropped a node type (from palette buttons if they were draggable)
      if (type) {
        addNode(type, position);
      }
    },
    [reactFlowInstance, addNode, currentWorkflow.nodes, updateStoreNodes, setSelectedNode, setNodes]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDragEnter = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <div
      ref={reactFlowWrapper}
      className="h-full w-full relative"
      style={{ background: 'var(--bg-primary)' }}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDrop={onDrop}
    >
      {/* ── Workflow Toolbar ─────────────────────────────────────── */}
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-3">
        {/* Workflow Name Input */}
        <div className="bg-surface-1/80 backdrop-blur-md border border-[var(--border-2)] rounded-xl px-4 py-2.5 shadow-glass flex items-center gap-3 group focus-within:border-[var(--accent)] transition-all">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-surface-400 group-focus-within:text-[var(--accent)]">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <input
            type="text"
            value={currentWorkflow.name}
            onChange={(e) => updateWorkflowField('name', e.target.value)}
            className="bg-transparent text-[var(--text-primary)] font-bold text-[13px] focus:outline-none min-w-[240px] placeholder:text-surface-600"
            placeholder="Name your workflow..."
          />
        </div>

        {/* Action Controls */}
        <div className="flex gap-2.5 p-1.5 bg-surface-1/80 backdrop-blur-md border border-[var(--border-2)] rounded-xl shadow-glass">
          <button
            onClick={() => handleAddNode('api')}
            className="btn-primary flex gap-2"
          >
            <Plus size={14} strokeWidth={3} />
            <span className='text-[10px] font-bold uppercase tracking-wide'>API Node</span>
          </button>
          <button
            onClick={() => handleAddNode('delay')}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-surface-3 text-[var(--text-primary)] border border-[var(--border-2)] rounded-lg hover:bg-surface-4 transition-all font-bold text-[11px] uppercase tracking-wide"
          >
            <Plus size={14} strokeWidth={3} />
            Delay
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-surface-2 text-[var(--text-primary)] hover:bg-surface-3 rounded-lg transition-all font-bold text-[11px] uppercase tracking-wide border border-transparent hover:border-[var(--border-2)] disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          
          <button
            onClick={handleRefresh}
            disabled={isLoadingWorkflows}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-surface-2 text-[var(--text-primary)] hover:bg-surface-3 rounded-lg transition-all font-bold text-[11px] uppercase tracking-wide border border-transparent hover:border-[var(--border-2)] disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoadingWorkflows ? 'animate-spin' : ''} />
          </button>

          <div className="w-px h-5 bg-[var(--border-2)] self-center mx-1" />
          
          {isExecuting ? (
            <div className="flex gap-1 bg-black/20 rounded-lg p-0.5">
              {isPaused ? (
                <button
                  onClick={resumeExecution}
                  className="p-1.5 text-green-500 hover:bg-green-500/10 rounded-md transition-all"
                  title="Resume Execution"
                >
                  <Play size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={pauseExecution}
                  className="p-1.5 text-yellow-500 hover:bg-yellow-500/10 rounded-md transition-all"
                  title="Pause Execution"
                >
                  <Pause size={14} fill="currentColor" />
                </button>
              )}
              <button
                onClick={cancelExecution}
                className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md transition-all"
                title="Stop Execution"
              >
                <Square size={14} fill="currentColor" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all font-bold text-[11px] uppercase tracking-wide shadow-sm ${isExecuting
                ? 'bg-surface-3 text-surface-500 cursor-not-allowed'
                : 'bg-green-600/20 text-green-500 border border-green-600/30 hover:bg-green-600/30'
                }`}
            >
              <Play size={14} fill="currentColor" />
              Run Workflow
            </button>
          )}
        </div>
      </div>

      {/* Global Loaders */}
      {isLoadingWorkflows && (
        <div className="absolute inset-0 z-[100] bg-black/5 flex items-center justify-center backdrop-blur-[1px]">
          <div className="bg-surface-1/90 border border-[var(--border-2)] rounded-2xl px-6 py-4 shadow-glass-heavy flex items-center gap-3">
             <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
             <span className="text-[12px] font-bold text-[var(--text-primary)] uppercase tracking-widest">Refreshing...</span>
          </div>
        </div>
      )}

      {/* ── Execution Dashboard ──────────────────────────────────── */}
      {executionResult && (
        <div className="absolute top-6 right-6 z-10 bg-surface-1/90 backdrop-blur-xl border border-[var(--border-2)] rounded-2xl p-5 shadow-glass-heavy min-w-[280px] animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[12px] font-black uppercase tracking-widest text-surface-400">Execution Report</h3>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight ${executionResult.status === 'success' ? 'bg-green-500/10 text-green-500' :
              executionResult.status === 'partial' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'
              }`}>
              {executionResult.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-surface-2 rounded-xl p-3 border border-[var(--border-2)]">
              <div className="text-[10px] font-bold text-surface-500 uppercase mb-1">Time</div>
              <div className="text-[15px] font-mono font-bold text-[var(--text-primary)]">{executionResult.duration}<span className="text-[10px] ml-0.5 opacity-50">ms</span></div>
            </div>
            <div className="bg-surface-2 rounded-xl p-3 border border-[var(--border-2)]">
              <div className="text-[10px] font-bold text-surface-500 uppercase mb-1">Success</div>
              <div className="text-[15px] font-mono font-bold text-green-500">{executionResult.success_count}</div>
            </div>
          </div>

          <div className="bg-surface-2/50 rounded-xl p-3 border border-[var(--border-2)] flex items-center justify-between">
            <span className="text-[10px] font-bold text-surface-500 uppercase">Failures</span>
            <span className={`text-[14px] font-mono font-bold ${executionResult.failed_count > 0 ? 'text-red-500' : 'text-surface-400'}`}>
              {executionResult.failed_count}
            </span>
          </div>

          <button
            onClick={() => useWorkflowStore.setState({ showResultsLog: !useWorkflowStore.getState().showResultsLog })}
            className="w-full mt-4 py-2 bg-surface-2 border border-[var(--border-2)] rounded-xl text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)] hover:bg-surface-3 transition-all flex items-center justify-center gap-2"
          >
            {useWorkflowStore.getState().showResultsLog ? 'Hide Full Log' : 'View Full Log'}
          </button>

          <button
            onClick={handleExportExcel}
            className="w-full mt-2 py-2 bg-green-600/10 border border-green-600/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-green-500 hover:bg-green-600/20 transition-all flex items-center justify-center gap-2"
          >
            <Save size={12} />
            Generate Test Report (XLSX)
          </button>

          {useWorkflowStore.getState().showResultsLog && (
            <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-hide animate-in slide-in-from-top-2 duration-200">
              {executionResult.node_results?.map((res, i) => (
                <div key={i} className="bg-surface-2/30 border border-[var(--border-2)] rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${res.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-[11px] font-bold text-[var(--text-primary)] truncate">{res.node_name}</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-surface-500">{res.duration}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-widest text-surface-600">
                      {res.request?.method || (res.response ? 'API' : 'DELAY')}
                    </span>
                    <span className={`text-[10px] font-mono font-bold ${res.response?.status < 400 ? 'text-green-500' : 'text-red-500'}`}>
                      {res.response?.status || (res.status === 'success' ? 'DONE' : 'FAIL')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => useWorkflowStore.setState({ executionResult: null, showResultsLog: false })}
            className="w-full mt-4 py-2 text-[10px] font-bold uppercase tracking-widest text-surface-500 hover:text-[var(--text-primary)] transition-colors"
          >
            Dismiss Report
          </button>
        </div>
      )}

      <ReactFlow
        nodes={nodesWithStatus}
        edges={edgesWithConditions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        nodeTypes={nodeTypes}
        fitView
        style={{ background: 'var(--bg-primary)' }}
      >
        <Background color="var(--border-1)" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.data.executionStatus === 'success') return '#10b981';
            if (node.data.executionStatus === 'failed') return '#ef4444';
            return 'var(--surface-2)';
          }}
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border-1)' }}
        />
      </ReactFlow>

      {/* Context Menu */}
      {menu && (
        <div
          className="fixed z-[9999] bg-[var(--surface-1)] border border-[var(--border-2)] rounded-2xl shadow-glass backdrop-blur-xl p-1.5 min-w-[180px] animate-in fade-in zoom-in-95 duration-150"
          style={{ top: menu.top, left: menu.left }}
        >
          <button
            onClick={() => {
              toggleNodeSkip(menu.id);
              const newState = !menu.data.skipped;
              setMenu(null);
              toast.success(newState ? 'Node will be skipped' : 'Node reactivated');
            }}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold text-[var(--text-primary)] hover:bg-[var(--accent)] hover:text-black transition-all group"
          >
            <div className="flex items-center gap-2">
              <ShieldOff size={14} className="opacity-70" />
              {menu.data.skipped ? 'Reactivate Node' : 'Skip Node'}
            </div>
            {menu.data.skipped && (
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
            )}
          </button>

          {menu.type === 'api' && (
            <button
              onClick={() => {
                toggleNodeSession(menu.id);
                const newState = !menu.data.save_session;
                setMenu(null);
                toast.success(newState ? 'Session persistence enabled' : 'Session persistence disabled');
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold text-[var(--text-primary)] hover:bg-[var(--accent)] hover:text-black transition-all group"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="opacity-70" />
                {menu.data.save_session ? 'Disable Session' : 'Save Session'}
              </div>
              {menu.data.save_session && (
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              )}
            </button>
          )}

          <button
            onClick={async () => {
              const confirmed = await confirm(`Are you sure you want to delete "${menu.data.name || 'this node'}"?`, {
                title: 'Delete Node',
                type: 'warning'
              });
              if (confirmed) {
                deleteWorkflowNode(menu.id);
                setMenu(null);
                toast.success('Node deleted');
              }
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold text-red-400 hover:bg-red-500 hover:text-white transition-all"
          >
            <Trash2 size={14} className="opacity-70" />
            Delete Node
          </button>
        </div>
      )}

      {/* Edge Context Menu */}
      {edgeMenu && (
        <div
          className="fixed z-[9999] bg-[var(--surface-1)] border border-[var(--border-2)] rounded-2xl shadow-glass backdrop-blur-xl p-1.5 min-w-[180px] animate-in fade-in zoom-in-95 duration-150"
          style={{ top: edgeMenu.top, left: edgeMenu.left }}
        >
          <div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-surface-500 border-b border-[var(--border-2)] mb-1">
            Execution Condition
          </div>
          
          <button
            onClick={() => {
              updateWorkflowEdge(edgeMenu.id, { condition: 'always' });
              setEdgeMenu(null);
              toast.success('Condition set to Always');
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              edgeMenu.condition === 'always' ? 'bg-surface-3 text-[var(--accent)]' : 'text-[var(--text-primary)] hover:bg-surface-2'
            }`}
          >
            Always Run
          </button>

          <button
            onClick={() => {
              updateWorkflowEdge(edgeMenu.id, { condition: 'success' });
              setEdgeMenu(null);
              toast.success('Condition set to On Success');
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              edgeMenu.condition === 'success' ? 'bg-green-500/10 text-green-500' : 'text-[var(--text-primary)] hover:bg-surface-2'
            }`}
          >
            On Success
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </button>

          <button
            onClick={() => {
              updateWorkflowEdge(edgeMenu.id, { condition: 'failure' });
              setEdgeMenu(null);
              toast.success('Condition set to On Failure');
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              edgeMenu.condition === 'failure' ? 'bg-red-500/10 text-red-500' : 'text-[var(--text-primary)] hover:bg-surface-2'
            }`}
          >
            On Failure
            <div className="w-2 h-2 rounded-full bg-red-500" />
          </button>

          <div className="h-px bg-[var(--border-2)] my-1" />

          <button
            onClick={async () => {
              const confirmed = await confirm('Remove this connection?', { title: 'Delete Connection', type: 'warning' });
              if (confirmed) {
                deleteWorkflowEdge(edgeMenu.id);
                setEdgeMenu(null);
                toast.success('Connection removed');
              }
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold text-red-400 hover:bg-red-500 hover:text-white transition-all"
          >
            <Trash2 size={14} className="opacity-70" />
            Remove Edge
          </button>
        </div>
      )}
    </div>
  );
}

// Wrap with ReactFlowProvider
export default function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
}
