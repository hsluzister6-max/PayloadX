import { useState, useEffect, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';

import { useApiDocStore } from '@/store/apiDocStore';
import { useSocketStore } from '@/store/socketStore';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import ApiDocPresence from './ApiDocPresence';

const TABS = ['Info', 'Params', 'Headers', 'Body', 'Responses'];
const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
const METHOD_COLORS = {
  GET: '#3FB950', POST: '#58A6FF', PUT: '#E3B341', PATCH: '#A8A8A8',
  DELETE: '#F85149', HEAD: '#5A5A5A', OPTIONS: '#39C5CF',
};

// Generates a random alphanumeric ID
const genId = () => Math.random().toString(36).substr(2, 9);

export default function EndpointEditor({ endpoint, docId }) {
  const { theme } = useUIStore();
  const { updateEndpoint, deleteEndpoint } = useApiDocStore();
  const { socket } = useSocketStore();
  const { currentTeam } = useTeamStore();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState('Info');
  const [localEp, setLocalEp] = useState(endpoint);
  const [isSaving, setIsSaving] = useState(false);
  const typingRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Presence Logic
  const prevEpIdRef = useRef(null);
  useEffect(() => {
    if (!endpoint.id || !currentTeam || !user) return;

    // Close previous if changed
    if (prevEpIdRef.current && prevEpIdRef.current !== endpoint.id) {
      socket?.emit('close_apidoc', { teamId: currentTeam._id, endpointId: prevEpIdRef.current });
    }

    // Open current
    socket?.emit('open_apidoc', { teamId: currentTeam._id, endpointId: endpoint.id, user });
    prevEpIdRef.current = endpoint.id;

    return () => {
      if (endpoint.id && currentTeam) {
        socket?.emit('close_apidoc', { teamId: currentTeam._id, endpointId: endpoint.id });
      }
    };
  }, [endpoint.id, currentTeam?._id]);

  // Sync with prop changes if it's a different endpoint
  useEffect(() => {
    if (endpoint.id !== localEp.id) {
      setLocalEp(endpoint);
      setActiveTab('Info');
    }
  }, [endpoint.id]);

  // Auto-save logic
  const triggerSave = (newEp) => {
    setLocalEp(newEp);

    // Clear previous timeout
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    // Set new timeout for 1 second
    saveTimeoutRef.current = setTimeout(() => {
      setIsSaving(true);
      updateEndpoint(docId, newEp).finally(() => setIsSaving(false));
    }, 1000);

    // Emit typing indicator
    if (socket && currentTeam && user) {
      if (typingRef.current) clearTimeout(typingRef.current);
      socket.emit('apidoc_typing_start', { teamId: currentTeam._id, docId, endpointId: newEp.id, userId: user.id });

      typingRef.current = setTimeout(() => {
        socket.emit('apidoc_typing_stop', { teamId: currentTeam._id, docId, endpointId: newEp.id, userId: user.id });
      }, 2000);
    }
  };

  const handleFieldChange = (field, value) => {
    triggerSave({ ...localEp, [field]: value });
  };

  // Generic List Manager (Params, Headers)
  const addListItem = (field, defaultItem) => {
    const nextList = [...(localEp[field] || []), { ...defaultItem, id: genId() }];
    triggerSave({ ...localEp, [field]: nextList });
  };
  const updateListItem = (field, id, key, value) => {
    const nextList = (localEp[field] || []).map((item) => item.id === id ? { ...item, [key]: value } : item);
    triggerSave({ ...localEp, [field]: nextList });
  };
  const removeListItem = (field, id) => {
    const nextList = (localEp[field] || []).filter((item) => item.id !== id);
    triggerSave({ ...localEp, [field]: nextList });
  };

  // Body Manager
  const updateBody = (schemaStr) => {
    triggerSave({
      ...localEp,
      requestBody: { ...localEp.requestBody, schema: schemaStr }
    });
  };

  // Response Manager
  const addResponse = () => {
    const nextResponses = [
      ...(localEp.responses || []),
      { id: genId(), statusCode: 200, description: 'Success', schema: '{}' }
    ];
    triggerSave({ ...localEp, responses: nextResponses });
  };
  const updateResponse = (id, key, val) => {
    const nextResponses = (localEp.responses || []).map(r => r.id === id ? { ...r, [key]: val } : r);
    triggerSave({ ...localEp, responses: nextResponses });
  };
  const removeResponse = (id) => {
    const nextResponses = (localEp.responses || []).filter(r => r.id !== id);
    triggerSave({ ...localEp, responses: nextResponses });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this endpoint?')) {
      deleteEndpoint(docId, endpoint.id);
    }
  };

  const methodColor = METHOD_COLORS[localEp.method] || '#9A9A9A';

  return (
    <div className="flex flex-col h-full bg-surface-1">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-1)] bg-surface-2 flex-shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Method Badge & Selector */}
          <div className="relative group">
            <select
              value={localEp.method}
              onChange={(e) => handleFieldChange('method', e.target.value)}
              style={{ color: methodColor }}
              className="appearance-none bg-transparent font-bold text-xs pl-2 pr-6 py-1 border border-transparent hover:border-[var(--border-2)] rounded cursor-pointer outline-none w-24 text-center z-10 relative"
            >
              {METHODS.map(m => <option key={m} value={m} className="text-tx-primary bg-surface-1">{m}</option>)}
            </select>
            <div className="absolute inset-y-0 right-1 flex items-center pointer-events-none text-surface-400 group-hover:text-tx-secondary">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </div>
          </div>

          {/* Path Input */}
          <input
            value={localEp.path}
            onChange={(e) => handleFieldChange('path', e.target.value)}
            placeholder="/api/v1/resource"
            className="flex-1 bg-transparent border border-transparent hover:border-[var(--border-2)] focus:border-accent focus:bg-surface-1 rounded px-2 py-1 text-[13px] font-mono text-tx-primary outline-none transition-all"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 ml-4">
          <ApiDocPresence endpointId={endpoint.id} />
          <div className="w-px h-4 bg-[var(--border-1)] mx-1"></div>
          {isSaving && <span className="text-[10px] text-surface-400 animate-pulse">Saving...</span>}
          <button onClick={handleDelete} title="Delete Endpoint" className="p-1.5 text-surface-500 hover:text-error hover:bg-error/10 rounded-md transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
          </button>
        </div>
      </div>

      {/* ── TABS NAV ── */}
      <div className="flex px-3 border-b border-[var(--border-1)] flex-shrink-0 bg-surface-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab
                ? 'text-accent border-accent bg-accent/5'
                : 'text-surface-500 border-transparent hover:text-tx-primary hover:border-surface-400'
              }`}
          >
            {tab}
            {tab === 'Params' && localEp.queryParams?.length > 0 && <span className="ml-1.5 opacity-60">({localEp.queryParams.length})</span>}
            {tab === 'Headers' && localEp.headers?.length > 0 && <span className="ml-1.5 opacity-60">({localEp.headers.length})</span>}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="flex-1 overflow-y-auto w-full max-w-full">
        <div className="p-4 max-w-4xl max-w-[100%] w-full h-full flex flex-col">

          {/* INFO TAB */}
          {activeTab === 'Info' && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-surface-400">Summary (Short title)</label>
                <input
                  value={localEp.summary || ''}
                  onChange={(e) => handleFieldChange('summary', e.target.value)}
                  placeholder="e.g. Get User Profile"
                  className="w-full px-3 py-2 bg-surface-2 border border-[var(--border-1)] rounded-lg text-[13px] text-tx-primary focus:border-accent outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-surface-400">Description (Markdown supported)</label>
                <textarea
                  value={localEp.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="Detailed description of what this endpoint does..."
                  rows={6}
                  className="w-full px-3 py-2 bg-surface-2 border border-[var(--border-1)] rounded-lg text-[13px] text-tx-primary focus:border-accent outline-none resize-y font-sans"
                />
              </div>
            </div>
          )}

          {/* PARAMS TAB */}
          {activeTab === 'Params' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-surface-400">Query parameters passed in the URL.</p>
                <button
                  onClick={() => addListItem('queryParams', { name: '', type: 'string', required: false, description: '' })}
                  className="px-2.5 py-1.5 bg-surface-3 hover:bg-surface-4 text-tx-primary rounded text-xs font-medium border border-[var(--border-1)] flex items-center gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 4v16m8-8H4" /></svg> Add Param
                </button>
              </div>

              {localEp.queryParams?.length > 0 ? (
                <div className="border border-[var(--border-1)] rounded-lg overflow-hidden bg-surface-2 text-[12px]">
                  <div className="grid grid-cols-[1fr_80px_60px_1.5fr_30px] gap-2 p-2 bg-surface-3 border-b border-[var(--border-1)] font-medium text-surface-400">
                    <div className="pl-1">Name</div><div>Type</div><div className="text-center">Req?</div><div>Description</div><div></div>
                  </div>
                  {localEp.queryParams.map((qp) => (
                    <div key={qp.id} className="grid grid-cols-[1fr_80px_60px_1.5fr_30px] gap-2 p-1.5 items-center border-b border-[var(--border-1)] last:border-0 group hover:bg-surface-3">
                      <input value={qp.name} onChange={(e) => updateListItem('queryParams', qp.id, 'name', e.target.value)} placeholder="name" className="bg-transparent border border-transparent focus:border-[var(--border-2)] rounded px-1.5 py-1 text-tx-primary font-mono outline-none w-full" />
                      <select value={qp.type} onChange={(e) => updateListItem('queryParams', qp.id, 'type', e.target.value)} className="bg-transparent border border-transparent focus:border-[var(--border-2)] rounded px-1 py-1 text-tx-primary outline-none w-full">
                        <option value="string">string</option><option value="number">number</option>
                        <option value="boolean">boolean</option><option value="array">array</option>
                      </select>
                      <div className="flex justify-center">
                        <input type="checkbox" checked={qp.required} onChange={(e) => updateListItem('queryParams', qp.id, 'required', e.target.checked)} className="accent-accent w-3.5 h-3.5 cursor-pointer rounded" />
                      </div>
                      <input value={qp.description} onChange={(e) => updateListItem('queryParams', qp.id, 'description', e.target.value)} placeholder="description" className="bg-transparent border border-transparent focus:border-[var(--border-2)] rounded px-1.5 py-1 text-tx-secondary outline-none w-full" />
                      <button onClick={() => removeListItem('queryParams', qp.id)} className="opacity-0 group-hover:opacity-100 p-1 text-surface-500 hover:text-error rounded flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-8 text-center text-surface-500 text-xs italic">No query parameters defined.</div>
              )}
            </div>
          )}

          {/* HEADERS TAB */}
          {activeTab === 'Headers' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-surface-400">HTTP headers sent with the request.</p>
                <button
                  onClick={() => addListItem('headers', { key: '', value: '' })}
                  className="px-2.5 py-1.5 bg-surface-3 hover:bg-surface-4 text-tx-primary rounded text-xs font-medium border border-[var(--border-1)] flex items-center gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 4v16m8-8H4" /></svg> Add Header
                </button>
              </div>

              {localEp.headers?.length > 0 ? (
                <div className="border border-[var(--border-1)] rounded-lg overflow-hidden bg-surface-2 text-[12px]">
                  <div className="grid grid-cols-[1fr_1fr_30px] gap-2 p-2 bg-surface-3 border-b border-[var(--border-1)] font-medium text-surface-400">
                    <div className="pl-1">Key</div><div>Value / Example</div><div></div>
                  </div>
                  {localEp.headers.map((h) => (
                    <div key={h.id} className="grid grid-cols-[1fr_1fr_30px] gap-2 p-1.5 items-center border-b border-[var(--border-1)] last:border-0 group hover:bg-surface-3">
                      <input value={h.key} onChange={(e) => updateListItem('headers', h.id, 'key', e.target.value)} placeholder="Authorization" className="bg-transparent border border-transparent focus:border-[var(--border-2)] rounded px-1.5 py-1 text-tx-primary font-mono outline-none w-full" />
                      <input value={h.value} onChange={(e) => updateListItem('headers', h.id, 'value', e.target.value)} placeholder="Bearer <token>" className="bg-transparent border border-transparent focus:border-[var(--border-2)] rounded px-1.5 py-1 text-tx-secondary font-mono outline-none w-full" />
                      <button onClick={() => removeListItem('headers', h.id)} className="opacity-0 group-hover:opacity-100 p-1 text-surface-500 hover:text-error rounded flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-8 text-center text-surface-500 text-xs italic">No headers defined.</div>
              )}
            </div>
          )}

          {/* BODY TAB */}
          {activeTab === 'Body' && (
            <div className="flex flex-col h-full min-h-[300px]">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-surface-400">JSON Schema for the request body payload.</p>
                <div className="text-[10px] bg-surface-3 px-2 py-0.5 rounded text-tx-secondary font-mono border border-[var(--border-1)]">
                  {localEp.requestBody?.contentType || 'application/json'}
                </div>
              </div>
              <div className="flex-1 border border-[var(--border-1)] rounded-lg overflow-hidden" style={{ minHeight: 200 }}>
                <textarea
                  value={localEp.requestBody?.schema || '{}'}
                  onChange={e => updateBody(e.target.value)}
                  style={{ width: '100%', height: '100%', minHeight: 200, background: '#07090d', color: '#C8CDD8', border: 'none', outline: 'none', resize: 'none', padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.7, tabSize: 2 }}
                  spellCheck={false}
                  onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); const s = e.target.selectionStart; const v = e.target.value; const nv = v.slice(0, s) + '  ' + v.slice(s); updateBody(nv); setTimeout(() => { e.target.selectionStart = e.target.selectionEnd = s + 2; }, 0); } }}
                />
              </div>

            </div>
          )}

          {/* RESPONSES TAB */}
          {activeTab === 'Responses' && (
            <div className="flex flex-col gap-4 h-full min-h-[300px]">
              <div className="flex items-center justify-between">
                <p className="text-xs text-surface-400">Possible HTTP responses and their schemas.</p>
                <button
                  onClick={addResponse}
                  className="px-2.5 py-1.5 bg-surface-3 hover:bg-surface-4 text-tx-primary rounded text-xs font-medium border border-[var(--border-1)] flex items-center gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 4v16m8-8H4" /></svg> Add Response
                </button>
              </div>

              {localEp.responses?.length > 0 ? (
                <div className="flex flex-col gap-4 flex-1">
                  {localEp.responses.map((res) => (
                    <div key={res.id} className="border border-[var(--border-1)] rounded-lg bg-surface-2 flex flex-col h-64 overflow-hidden shadow-sm">
                      <div className="flex items-center gap-2 p-2 border-b border-[var(--border-1)] bg-surface-3">
                        <select
                          value={res.statusCode}
                          onChange={(e) => updateResponse(res.id, 'statusCode', parseInt(e.target.value))}
                          className="bg-surface-1 border border-[var(--border-2)] focus:border-accent rounded px-2 py-1 text-xs font-mono outline-none font-bold"
                          style={{ color: res.statusCode >= 200 && res.statusCode < 300 ? '#3FB950' : res.statusCode >= 400 ? '#F85149' : '#58A6FF' }}
                        >
                          <option value="200">200 OK</option><option value="201">201 Created</option>
                          <option value="204">204 No Content</option><option value="400">400 Bad Request</option>
                          <option value="401">401 Unauthorized</option><option value="403">403 Forbidden</option>
                          <option value="404">404 Not Found</option><option value="500">500 Server Error</option>
                        </select>
                        <input
                          value={res.description}
                          onChange={(e) => updateResponse(res.id, 'description', e.target.value)}
                          placeholder="Response description"
                          className="flex-1 bg-transparent border border-transparent hover:border-[var(--border-2)] focus:border-[var(--border-2)] focus:bg-surface-1 rounded px-2 py-1 text-[13px] text-tx-primary outline-none"
                        />
                        <button onClick={() => removeResponse(res.id)} title="Delete response" className="p-1.5 text-surface-500 hover:text-error hover:bg-error/10 rounded-md transition-colors ml-auto mr-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                        </button>
                      </div>
                      <div className="flex-1 relative" style={{ minHeight: 120 }}>
                        <div className="absolute top-0 right-4 z-10 bg-surface-3 text-[9px] px-2 py-0.5 rounded-b text-tx-secondary font-mono border-x border-b border-[var(--border-1)] opacity-70">
                          body schema (JSON)
                        </div>
                        <textarea
                          value={res.schema || '{}'}
                          onChange={e => updateResponse(res.id, 'schema', e.target.value)}
                          style={{ width: '100%', height: '100%', minHeight: 120, background: '#07090d', color: '#C8CDD8', border: 'none', outline: 'none', resize: 'none', padding: '28px 12px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.7 }}
                          spellCheck={false}
                          onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); const s = e.target.selectionStart; const v = e.target.value; const nv = v.slice(0, s) + '  ' + v.slice(s); updateResponse(res.id, 'schema', nv); setTimeout(() => { e.target.selectionStart = e.target.selectionEnd = s + 2; }, 0); } }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-8 text-center text-surface-500 text-xs italic">No responses defined. Add at least one (e.g. 200 OK).</div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
