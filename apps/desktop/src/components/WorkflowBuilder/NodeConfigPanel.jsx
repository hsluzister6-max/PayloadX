import { useState, useMemo } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useProjectStore } from '@/store/projectStore';
import { 
  X, Plus, Trash2, Settings2, Code2, Globe, Clock, Layers, 
  Search, CheckCircle2, AlertCircle, ChevronDown, Database, ArrowRight
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useEnvironmentStore } from '@/store/environmentStore';
import VariableUrlInput from '@/components/RequestBuilder/VariableUrlInput';
import { localStorageService } from '@/services/localStorageService';

export default function NodeConfigPanel() {
  const { 
    currentWorkflow, 
    selectedNode, 
    updateNode, 
    setSelectedNode, 
    showConfigPanel,
    executionResult 
  } = useWorkflowStore();
  const { collections, requests } = useCollectionStore();
  const { currentProject } = useProjectStore();
  
  const [showApiPicker, setShowApiPicker] = useState(false);
  const [apiSearch, setApiSearch] = useState('');

  // ─── API Picker Helpers (Must be before early returns!) ───────
  const groupedRequests = useMemo(() => {
    if (!currentProject) return {};
    
    // Get all collections for this project
    const projectCols = collections.filter(c => c.projectId === currentProject._id);
    const colIds = new Set(projectCols.map(c => c._id));
    
    const groups = {};
    
    projectCols.forEach(col => {
      // Find requests belonging to this collection in store
      const storeRequests = requests.filter(r => r.collectionId === col._id);
      
      // Fallback to local storage if store is empty for this collection
      const allColRequests = storeRequests.length > 0 
        ? storeRequests 
        : localStorageService.getRequests(col._id);
      
      if (allColRequests.length > 0) {
        const filtered = allColRequests.filter(r => 
          !apiSearch || 
          r.name.toLowerCase().includes(apiSearch.toLowerCase()) || 
          r.url?.toLowerCase().includes(apiSearch.toLowerCase())
        );
        
        if (filtered.length > 0) {
          groups[col.name] = filtered;
        }
      }
    });
    return groups;
  }, [collections, requests, currentProject, apiSearch]);

  if (!showConfigPanel || !selectedNode) return null;

  const node = currentWorkflow.nodes.find((n) => n.id === selectedNode);
  if (!node) return null;

  const nodeResult = executionResult?.node_results?.find(r => r.node_id === selectedNode);

  const handleUpdate = (field, value) => {
    updateNode(selectedNode, { [field]: value });
  };

  const addHeader = () => {
    const headers = node.data.headers || [];
    handleUpdate('headers', [...headers, { id: uuidv4(), key: '', value: '', enabled: true }]);
  };

  const updateHeader = (index, field, value) => {
    const headers = [...(node.data.headers || [])];
    headers[index] = { ...headers[index], [field]: value };
    handleUpdate('headers', headers);
  };

  const removeHeader = (index) => {
    const headers = [...(node.data.headers || [])];
    headers.splice(index, 1);
    handleUpdate('headers', headers);
  };

  // ─── Validation Helpers ─────────────────────────────────────
  const addValidation = () => {
    const validations = node.data.validations || [];
    handleUpdate('validations', [...validations, { id: uuidv4(), type: 'status_code', target: '200', enabled: true }]);
  };

  const updateValidation = (index, field, value) => {
    const validations = [...(node.data.validations || [])];
    validations[index] = { ...validations[index], [field]: value };
    handleUpdate('validations', validations);
  };

  const removeValidation = (index) => {
    const validations = [...(node.data.validations || [])];
    validations.splice(index, 1);
    handleUpdate('validations', validations);
  };

  const addMapping = () => {
    const mappings = node.data.data_mappings || [];
    handleUpdate('data_mappings', [...mappings, { id: uuidv4(), source_expression: '', target_field: '', transform: '' }]);
  };

  const updateMapping = (index, field, value) => {
    const mappings = [...(node.data.data_mappings || [])];
    mappings[index] = { ...mappings[index], [field]: value };
    handleUpdate('data_mappings', mappings);
  };

  const removeMapping = (index) => {
    const mappings = [...(node.data.data_mappings || [])];
    mappings.splice(index, 1);
    handleUpdate('data_mappings', mappings);
  };

  const handlePickApi = (req) => {
    handleUpdate('name', req.name);
    handleUpdate('method', req.method);
    handleUpdate('url', req.url);
    handleUpdate('headers', req.headers || []);
    handleUpdate('params', req.params || []);
    if (req.body?.raw) {
      try {
        handleUpdate('body', JSON.parse(req.body.raw));
      } catch (e) {
        handleUpdate('body', req.body.raw);
      }
    }
    setShowApiPicker(false);
  };

  const SectionHeader = ({ icon: Icon, title }) => (
    <div className="flex items-center gap-2 mb-3 mt-6">
      <Icon size={14} className="text-surface-500" />
      <span className="text-[10px] font-black uppercase tracking-widest text-surface-500">{title}</span>
    </div>
  );

  return (
    <div className="w-96 h-full bg-surface-1 border-l border-[var(--border-2)] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-2)] bg-surface-1/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-surface-2 border border-[var(--border-2)]">
            <Settings2 size={16} className="text-[var(--accent)]" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-[var(--text-primary)]">Configure Node</h3>
            <p className="text-[10px] text-surface-500 font-medium">ID: {node.id.slice(0, 8)}...</p>
          </div>
        </div>
        <button
          onClick={() => setSelectedNode(null)}
          className="p-2 hover:bg-surface-3 rounded-xl transition-all text-surface-500 hover:text-[var(--text-primary)]"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 scrollbar-hide">
        {/* Node Execution Result (Show only if exists) */}
        {nodeResult && (
          <div className="bg-surface-2/40 border border-[var(--accent)]/30 rounded-2xl p-4 shadow-glass-heavy animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className={nodeResult.status === 'success' ? 'text-green-500' : 'text-red-500'} />
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">Latest Execution</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-surface-500 bg-surface-3 px-2 py-0.5 rounded-full border border-[var(--border-2)]">
                {nodeResult.duration}ms
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-surface-1 border border-[var(--border-2)] rounded-xl p-2.5">
                <div className="text-[9px] font-bold text-surface-500 uppercase mb-1">Status</div>
                <div className={`text-[13px] font-mono font-bold ${nodeResult.response?.status < 400 ? 'text-green-500' : 'text-red-500'}`}>
                  {nodeResult.response?.status || 'Error'}
                </div>
              </div>
              <div className="bg-surface-1 border border-[var(--border-2)] rounded-xl p-2.5">
                <div className="text-[9px] font-bold text-surface-500 uppercase mb-1">Size</div>
                <div className="text-[13px] font-mono font-bold text-[var(--text-primary)]">
                  {nodeResult.response?.body ? (JSON.stringify(nodeResult.response.body).length / 1024).toFixed(2) : 0} KB
                </div>
              </div>
            </div>

            {nodeResult.response?.body && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                   <span className="text-[9px] font-bold text-surface-500 uppercase tracking-tight">Response Body</span>
                </div>
                <div className="bg-black/20 rounded-xl border border-[var(--border-2)] p-3 overflow-hidden">
                  <pre className="text-[10px] font-mono text-surface-400 overflow-x-auto scrollbar-hide max-h-[150px] leading-relaxed">
                    {typeof nodeResult.response.body === 'object' 
                      ? JSON.stringify(nodeResult.response.body, null, 2) 
                      : nodeResult.response.body}
                  </pre>
                </div>
              </div>
            )}

            {nodeResult.error && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-bold text-red-500 uppercase">Execution Error</span>
                  <p className="text-[10px] text-red-400 font-medium break-words leading-tight">{nodeResult.error.message}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Name */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-surface-500 uppercase tracking-wider px-1">Node Identity</label>
          <input
            type="text"
            value={node.data.name}
            onChange={(e) => handleUpdate('name', e.target.value)}
            className="w-full px-4 py-3 bg-surface-2 border border-[var(--border-2)] rounded-xl text-[13px] text-[var(--text-primary)] font-bold focus:outline-none focus:border-[var(--accent)] transition-all placeholder:text-surface-600 shadow-sm"
            placeholder="Node Name"
          />
        </div>

        {node.type === 'api' && (
          <>
            <div className="flex items-center justify-between">
              <SectionHeader icon={Globe} title="Target Endpoint" />
              <div className="relative mt-4">
                <button
                  onClick={() => setShowApiPicker(!showApiPicker)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-[var(--border-2)] rounded-lg text-[10px] font-black uppercase tracking-tight text-[var(--text-primary)] hover:bg-surface-3 transition-all"
                >
                  <Search size={12} />
                  Pick from Project
                </button>
                
                {showApiPicker && (
                  <div className="absolute top-full right-0 mt-2 w-72 bg-surface-1 border border-[var(--border-2)] rounded-xl shadow-glass-heavy z-[100] overflow-hidden flex flex-col max-h-[350px]">
                    <div className="p-2 border-b border-[var(--border-2)] bg-surface-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search project APIs..."
                        value={apiSearch}
                        onChange={(e) => setApiSearch(e.target.value)}
                        className="w-full px-3 py-1.5 bg-surface-1 border border-[var(--border-2)] rounded-lg text-[11px] focus:outline-none"
                      />
                    </div>
                    <div className="overflow-y-auto p-1.5 flex flex-col gap-2">
                      {Object.keys(groupedRequests).length > 0 ? (
                        Object.entries(groupedRequests).map(([colName, reqs]) => (
                          <div key={colName} className="flex flex-col gap-1">
                            <div className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-surface-500 bg-surface-2/50 rounded flex items-center gap-2">
                              <ChevronDown size={10} />
                              {colName}
                            </div>
                            <div className="flex flex-col gap-1 pl-2">
                              {reqs.map(req => (
                                <button
                                  key={req._id}
                                  onClick={() => handlePickApi(req)}
                                  className="flex items-center gap-3 p-2 hover:bg-surface-2 rounded-lg text-left transition-all group"
                                >
                                  <span className={`text-[9px] font-black w-8 text-center rounded py-0.5 ${
                                    req.method === 'GET' ? 'text-green-500 bg-green-500/10' : 
                                    req.method === 'POST' ? 'text-blue-500 bg-blue-500/10' : 
                                    'text-yellow-500 bg-yellow-500/10'
                                  }`}>
                                    {req.method}
                                  </span>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[11px] font-bold text-[var(--text-primary)] truncate">{req.name}</span>
                                    <span className="text-[9px] text-surface-500 truncate">{req.url || 'No URL'}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-[10px] text-surface-500 font-medium italic">No APIs found in this project</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-1">
                <select
                  value={node.data.method}
                  onChange={(e) => handleUpdate('method', e.target.value)}
                  className="w-full h-[46px] bg-surface-2 border border-[var(--border-2)] rounded-xl text-[11px] font-black text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] appearance-none text-center cursor-pointer hover:bg-surface-3 transition-all"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DEL</option>
                  <option value="PATCH">PTC</option>
                </select>
              </div>
              <div className="col-span-3">
                <div className="h-[46px] w-full bg-surface-2 border border-[var(--border-2)] rounded-xl focus-within:border-[var(--accent)] transition-all">
                  <VariableUrlInput
                    value={node.data.url || ''}
                    onChange={(e) => handleUpdate('url', e.target.value)}
                    placeholder="https://api.example.com/..."
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-8 mb-2">
              <SectionHeader icon={Layers} title="Request Headers" />
              <button
                onClick={addHeader}
                className="flex items-center gap-1 text-[10px] font-black uppercase text-[var(--accent)] hover:brightness-110 px-2 py-1 rounded-lg bg-[var(--accent)]/10"
              >
                <Plus size={12} strokeWidth={3} />
                Add Header
              </button>
            </div>
            
            <div className="space-y-2">
              {(node.data.headers || []).map((header, index) => (
                <div key={header.id} className="flex gap-2 group animate-in fade-in zoom-in-95 duration-200">
                  <input
                    type="text"
                    value={header.key}
                    onChange={(e) => updateHeader(index, 'key', e.target.value)}
                    placeholder="Key"
                    className="flex-1 px-3 py-2 bg-surface-2 border border-[var(--border-2)] rounded-xl text-[11px] font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <div className="flex-1 bg-surface-2 border border-[var(--border-2)] rounded-xl focus-within:border-[var(--accent)] transition-all flex items-center min-w-[120px]">
                    <VariableUrlInput
                      value={header.value}
                      onChange={(e) => updateHeader(index, 'value', e.target.value)}
                      placeholder="Value"
                    />
                  </div>
                  <button
                    onClick={() => removeHeader(index)}
                    className="p-2 hover:bg-red-500/10 text-surface-600 hover:text-red-500 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <SectionHeader icon={CheckCircle2} title="Expected Response" />
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-surface-500 uppercase px-1">Validations</span>
                <button
                  onClick={addValidation}
                  className="text-[10px] font-black uppercase text-[var(--accent)] flex items-center gap-1"
                >
                  <Plus size={12} strokeWidth={3} />
                  Add Validation
                </button>
              </div>
              
              <div className="space-y-2">
                {(node.data.validations || []).map((v, idx) => (
                  <div key={v.id} className="bg-surface-2 border border-[var(--border-2)] rounded-xl p-3 flex flex-col gap-2 relative group">
                    <div className="flex items-center justify-between">
                      <select
                        value={v.type}
                        onChange={(e) => updateValidation(idx, 'type', e.target.value)}
                        className="bg-transparent text-[10px] font-black uppercase tracking-tight text-[var(--accent)] focus:outline-none cursor-pointer"
                      >
                        <option value="status_code">Status Code</option>
                        <option value="body_contains">Body Contains</option>
                        <option value="json_match">JSON Path Match</option>
                      </select>
                      <button
                        onClick={() => removeValidation(idx)}
                        className="opacity-0 group-hover:opacity-100 text-surface-500 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={v.target}
                      onChange={(e) => updateValidation(idx, 'target', e.target.value)}
                      placeholder={v.type === 'status_code' ? '200' : 'Expected value...'}
                      className="w-full bg-surface-3 border border-[var(--border-2)] rounded-lg px-2 py-1.5 text-[11px] font-bold text-[var(--text-primary)] focus:outline-none"
                    />
                  </div>
                ))}
                {(!node.data.validations || node.data.validations.length === 0) && (
                  <div className="text-[10px] text-surface-600 text-center py-4 border-2 border-dashed border-[var(--border-2)] rounded-xl font-medium italic">
                    No validations active
                  </div>
                )}
              </div>
            </div>

            <SectionHeader icon={Code2} title="Request Payload" />
            <div className="bg-surface-2 rounded-2xl border border-[var(--border-2)] p-1 overflow-hidden shadow-inner">
              <textarea
                value={node.data.body ? (typeof node.data.body === 'object' ? JSON.stringify(node.data.body, null, 2) : node.data.body) : ''}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    handleUpdate('body', parsed);
                  } catch (err) {
                    handleUpdate('body', e.target.value);
                  }
                }}
                placeholder='{"key": "value"}'
                rows={8}
                className="w-full px-4 py-3 bg-transparent text-[var(--text-primary)] focus:outline-none font-mono text-[11px] leading-relaxed scrollbar-hide resize-none"
              />
            </div>

            <div className="flex items-center justify-between mt-8 mb-2">
              <SectionHeader icon={Database} title="Data Mappings" />
              <button
                onClick={addMapping}
                className="flex items-center gap-1 text-[10px] font-black uppercase text-[var(--accent)] hover:brightness-110 px-2 py-1 rounded-lg bg-[var(--accent)]/10"
              >
                <Plus size={12} strokeWidth={3} />
                Add Mapping
              </button>
            </div>
            
            <div className="space-y-3">
              {(node.data.data_mappings || []).map((mapping, index) => (
                <div key={mapping.id} className="p-3 bg-surface-2 border border-[var(--border-2)] rounded-xl relative group">
                  <button
                    onClick={() => removeMapping(index)}
                    className="absolute top-2 right-2 p-1.5 hover:bg-red-500/10 text-surface-500 hover:text-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-surface-500 uppercase">Source Node</label>
                        <select
                          className="w-full px-3 py-1.5 bg-surface-3 border border-[var(--border-2)] rounded-lg text-[10px] font-bold text-[var(--text-primary)] focus:outline-none appearance-none"
                          onChange={(e) => {
                            const nodeId = e.target.value;
                            if (nodeId) {
                              const existing = mapping.source_expression || '';
                              const parts = existing.split('.');
                              const newExpr = parts.length > 1 ? [nodeId, ...parts.slice(1)].join('.') : `${nodeId}.body`;
                              updateMapping(index, 'source_expression', newExpr);
                            }
                          }}
                          value={mapping.source_expression?.split('.')[0] || ''}
                        >
                          <option value="">Select Node...</option>
                          {currentWorkflow.nodes
                            .filter(n => n.id !== selectedNode)
                            .map(n => (
                              <option key={n.id} value={n.id}>{n.data.name || n.id.slice(0, 8)}</option>
                            ))
                          }
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-surface-500 uppercase">Source Field Path</label>
                        <input
                          type="text"
                          value={mapping.source_expression?.split('.').slice(1).join('.') || ''}
                          onChange={(e) => {
                            const nodeId = mapping.source_expression?.split('.')[0] || '';
                            updateMapping(index, 'source_expression', `${nodeId}.${e.target.value}`);
                          }}
                          placeholder="response.body.id"
                          className="w-full px-3 py-1.5 bg-surface-3 border border-[var(--border-2)] rounded-lg text-[10px] font-mono text-[var(--text-primary)] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-center -my-1">
                       <div className="flex flex-col items-center">
                         <span className="text-[8px] font-bold text-surface-600 uppercase mb-1">Maps To Child</span>
                         <ArrowRight size={14} className="text-surface-500" />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-surface-500 uppercase">Target Field Type</label>
                        <select
                          className="w-full px-3 py-1.5 bg-surface-3 border border-[var(--border-2)] rounded-lg text-[10px] font-bold text-[var(--text-primary)] focus:outline-none appearance-none"
                          onChange={(e) => {
                            const type = e.target.value;
                            const existing = mapping.target_field || '';
                            const parts = existing.split('.');
                            const newField = parts.length > 1 ? `${type}.${parts.slice(1).join('.')}` : `${type}.`;
                            updateMapping(index, 'target_field', newField);
                          }}
                          value={mapping.target_field?.split('.')[0] || ''}
                        >
                          <option value="">Select Type...</option>
                          <option value="params">Query Param</option>
                          <option value="headers">Header</option>
                          <option value="body">Body (Nested Path)</option>
                          <option value="url">Entire URL</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-surface-500 uppercase">Target Field Path</label>
                        <input
                          type="text"
                          value={mapping.target_field?.split('.').slice(1).join('.') || ''}
                          onChange={(e) => {
                            const type = mapping.target_field?.split('.')[0] || 'body';
                            updateMapping(index, 'target_field', `${type}.${e.target.value}`);
                          }}
                          placeholder="user.profile.id"
                          className="w-full px-3 py-1.5 bg-surface-3 border border-[var(--border-2)] rounded-lg text-[10px] font-mono text-[var(--text-primary)] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[9px] font-bold text-surface-500 uppercase">Final Source Expression</label>
                       <input
                         type="text"
                         value={mapping.source_expression}
                         onChange={(e) => updateMapping(index, 'source_expression', e.target.value)}
                         className="w-full px-3 py-1.5 bg-surface-3 border border-[var(--border-2)] rounded-lg text-[10px] font-mono text-[var(--accent)] focus:outline-none focus:border-[var(--accent)]"
                       />
                       <p className="text-[8px] text-surface-600 italic">Format: node_id.response.body.path</p>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[9px] font-bold text-surface-500 uppercase">Final Target Field</label>
                       <input
                         type="text"
                         value={mapping.target_field}
                         onChange={(e) => updateMapping(index, 'target_field', e.target.value)}
                         className="w-full px-3 py-1.5 bg-surface-3 border border-[var(--border-2)] rounded-lg text-[10px] font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                       />
                       <p className="text-[8px] text-surface-600 italic">Format: params.key, headers.key, or body.path</p>
                    </div>

                    <div className="space-y-1">
                       <label className="text-[9px] font-bold text-surface-500 uppercase">Transform (Optional)</label>
                       <select
                         value={mapping.transform || ''}
                         onChange={(e) => updateMapping(index, 'transform', e.target.value)}
                         className="w-full px-3 py-1.5 bg-surface-3 border border-[var(--border-2)] rounded-lg text-[10px] font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] appearance-none"
                       >
                         <option value="">None</option>
                         <option value="uppercase">Uppercase</option>
                         <option value="lowercase">Lowercase</option>
                       </select>
                    </div>
                  </div>
                </div>
              ))}
              {(!node.data.data_mappings || node.data.data_mappings.length === 0) && (
                 <div className="text-[10px] text-surface-600 text-center py-4 border-2 border-dashed border-[var(--border-2)] rounded-xl font-medium italic">
                   No data mappings configured
                 </div>
              )}
            </div>

            <SectionHeader icon={Code2} title="Expected Response Example" />
            <div className="bg-surface-2 rounded-2xl border border-[var(--border-2)] p-1 overflow-hidden shadow-inner">
              <textarea
                value={node.data.expected_response || ''}
                onChange={(e) => handleUpdate('expected_response', e.target.value)}
                placeholder="Paste expected JSON response here for reference in downstream nodes..."
                rows={6}
                className="w-full px-4 py-3 bg-transparent text-[var(--text-primary)] focus:outline-none font-mono text-[11px] leading-relaxed scrollbar-hide resize-none"
              />
            </div>

            <SectionHeader icon={Clock} title="Reliability" />
            <div className="bg-surface-2 rounded-2xl border border-[var(--border-2)] p-4 flex items-center justify-between">
              <span className="text-[11px] font-bold text-surface-500">Request Timeout</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={node.data.timeout || 30}
                  onChange={(e) => handleUpdate('timeout', parseInt(e.target.value))}
                  className="w-20 px-3 py-1.5 bg-surface-3 border border-[var(--border-2)] rounded-lg text-[12px] font-mono font-bold text-center text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
                <span className="text-[10px] font-bold text-surface-500">sec</span>
              </div>
            </div>
          </>
        )}

        {node.type === 'delay' && (
          <>
            <SectionHeader icon={Clock} title="Time Settings" />
            <div className="bg-surface-2 rounded-2xl border border-[var(--border-2)] p-6 flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                <Clock size={32} />
              </div>
              <div className="text-center">
                <h4 className="text-[14px] font-bold text-[var(--text-primary)] mb-1">Pause Execution</h4>
                <p className="text-[11px] text-surface-500 font-medium max-w-[200px]">How long should the workflow wait before proceeding to the next node?</p>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="number"
                  value={node.data.timeout || 1000}
                  onChange={(e) => handleUpdate('timeout', parseInt(e.target.value))}
                  className="w-32 px-4 py-2 bg-surface-3 border border-[var(--border-2)] rounded-xl text-[16px] font-mono font-bold text-center text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
                <span className="text-[11px] font-black uppercase text-surface-500">ms</span>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Environment Reference Section */}
      <div className="border-t border-[var(--border-2)] p-5 bg-surface-1/30 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-3">
          <Globe size={14} className="text-surface-500" />
          <span className="text-[11px] font-black uppercase tracking-widest text-surface-500">Variables</span>
        </div>
        <p className="text-[10px] text-surface-600 font-medium mb-3 leading-relaxed">
          Use <code className="text-[var(--accent)] font-bold">{"{{key}}"}</code> to inject variables into your request.
        </p>
        
        <EnvironmentReference />
      </div>

      {/* Footer info */}
      <div className="p-4 text-center border-t border-[var(--border-2)]">
         <p className="text-[9px] font-bold uppercase tracking-widest text-surface-600">PayloadX Node Automation Engine</p>
      </div>
    </div>
  );
}

function EnvironmentReference() {
  const { environments, currentEnvironment } = useEnvironmentStore();
  
  if (!currentEnvironment) {
    return (
      <div className="text-[10px] text-surface-600 text-center py-4 border border-dashed border-[var(--border-2)] rounded-xl font-medium italic">
        No environment active
      </div>
    );
  }
  
  const env = environments.find(e => e._id === currentEnvironment);
  if (!env || !env.variables || env.variables.length === 0) {
    return (
      <div className="text-[10px] text-surface-600 text-center py-4 border border-dashed border-[var(--border-2)] rounded-xl font-medium italic">
        No variables in {env?.name || 'environment'}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1 scrollbar-hide">
      {env.variables.map((v, i) => (
        <div key={i} className="flex items-center justify-between p-2 bg-surface-2/50 border border-[var(--border-2)] rounded-lg group hover:border-[var(--accent)] transition-all">
          <span className="text-[10px] font-mono font-bold text-[var(--accent)]">{v.key}</span>
          <span className="text-[10px] font-mono text-surface-500 truncate ml-2 max-w-[100px]">{v.value}</span>
        </div>
      ))}
    </div>
  );
}
