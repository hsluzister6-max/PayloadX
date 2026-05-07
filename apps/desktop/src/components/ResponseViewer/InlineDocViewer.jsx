import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useRequestStore } from '@/store/requestStore';

import { useUIStore } from '@/store/uiStore';
import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';
import { useAuthStore } from '@/store/authStore';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import './swagger-theme.css'; // We'll create this to make it dark

export default function InlineDocViewer() {
  const { currentRequest, updateField, saveRequest, response } = useRequestStore();
  const { theme } = useUIStore();
  const { currentTeam } = useTeamStore();
  const { currentProject } = useProjectStore();
  const { user } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [viewMode, setViewMode] = useState('swagger'); // 'markdown' | 'swagger'

  useEffect(() => {
    if (currentRequest) {
      setDescription(currentRequest.description || '');
      setIsEditing(false);
    }
  }, [currentRequest?.id]);

  if (!currentRequest) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-6 bg-surface-1">
        <p className="text-surface-400 text-sm">Select a request to view documentation</p>
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    updateField('description', description);

    // We delay the save by 50ms to ensure Zustand state has propagated 
    // to get() inside saveRequest.
    setTimeout(async () => {
      await saveRequest();
      setIsSaving(false);
      setIsEditing(false);
    }, 50);
  };

  const handleAIGenerate = () => {
    setIsGeneratingAI(true);

    // Simulate AI thinking and generating
    setTimeout(() => {
      const { method, url, name, params, headers, body } = currentRequest;
      const { response } = useRequestStore.getState();

      let aiDesc = `# ${name || 'API Documentation'}\n\n`;
      aiDesc += `This endpoint performs a **${method}** request to \`${url || '/'}\`.\n\n`;

      if (params?.length > 0 || headers?.length > 0) {
        aiDesc += `### Configuration\n`;
        aiDesc += `- **Parameters**: ${params?.filter(p => p.enabled).length || 0} active query parameters.\n`;
        aiDesc += `- **Headers**: ${headers?.filter(h => h.enabled).length || 0} active custom headers.\n\n`;
      }

      if (response) {
        aiDesc += `### Latest Execution Result\n`;
        aiDesc += `- **Status**: ${response.status} ${response.statusText}\n`;
        aiDesc += `- **Response Time**: ${response.responseTimeMs}ms\n`;
        aiDesc += `- **Size**: ${response.sizeBytes} bytes\n\n`;

        if (response.body) {
          aiDesc += `#### Response Schema (Inferred)\n`;
          aiDesc += `The response returns a structured payload. Based on the most recent execution, the primary keys include: \`${Object.keys(typeof response.body === 'string' ? (JSON.parse(response.body || '{}')) : response.body).join(', ')}\`.\n\n`;
        }
      }

      aiDesc += `### Implementation Notes\n`;
      aiDesc += `Ensure that the \`baseUrl\` is correctly configured for your environment. This documentation was automatically generated and refined by the PayloadX AI Documentation engine.`;

      setDescription(aiDesc);
      setIsGeneratingAI(false);
      setIsEditing(true); // Switch to edit mode so they can see/save it
      setViewMode('markdown'); // Switch to markdown to show the new content
      toast.success('AI Documentation generated!');
    }, 1200);
  };

  const methodColor = {
    GET: '#3FB950', POST: '#58A6FF', PUT: '#E3B341', PATCH: '#A8A8A8',
    DELETE: '#F85149', HEAD: '#5A5A5A', OPTIONS: '#39C5CF',
  }[currentRequest.method] || '#9A9A9A';

  const contentType = response?.headers?.['content-type'] || 'application/json';

  const jsonToSchema = (val) => {
    if (!val || typeof val !== 'object') return { type: typeof val || 'string', example: val };
    if (val.type || val.properties || val.items) return val;
    if (Array.isArray(val)) return { type: 'array', items: val.length > 0 ? jsonToSchema(val[0]) : { type: 'string' } };
    const properties = {};
    for (const [key, value] of Object.entries(val)) {
      properties[key] = jsonToSchema(value);
    }
    return { type: 'object', properties };
  };

  // Construct fake but useful Swagger JSON payload for view
  const swaggerPreview = {
    openapi: "3.0.0",
    info: {
      title: currentRequest.name || "API Request",
      description: description || "No description provided. Click AI Documentation to generate one.",
      version: "1.0.0"
    },
    servers: [
      { url: "/", description: "Relative Path" }
    ],
    paths: {
      [currentRequest.url?.split('?')[0] || '/']: {
        [currentRequest.method.toLowerCase()]: {
          summary: currentRequest.name,
          description: description,
          parameters: [
            ...(currentRequest.params?.filter(p => p.enabled && p.key).map(p => ({
              name: p.key,
              in: "query",
              description: p.description || "",
              schema: { type: "string", default: p.value }
            })) || []),
            ...(currentRequest.headers?.filter(h => h.enabled && h.key).map(h => ({
              name: h.key,
              in: "header",
              description: h.description || "",
              schema: { type: "string", default: h.value }
            })) || [])
          ],
          requestBody: ['POST', 'PUT', 'PATCH'].includes(currentRequest.method) ? {
            content: {
              "application/json": {
                schema: currentRequest.body?.mode === 'raw' ? (() => {
                  try {
                    const parsed = JSON.parse(currentRequest.body.raw || '{}');
                    return jsonToSchema(parsed);
                  } catch {
                    return { type: 'string', example: currentRequest.body.raw };
                  }
                })() :
                  (currentRequest.body?.mode === 'formdata' || currentRequest.body?.mode === 'urlencoded') ? {
                    type: 'object',
                    properties: (currentRequest.body[currentRequest.body.mode] || []).filter(i => i.enabled && i.key).reduce((acc, i) => ({
                      ...acc, [i.key]: { type: 'string', example: i.value }
                    }), {})
                  } : {}
              }
            }
          } : undefined,
          responses: {
            [response?.status || '200']: {
              description: response?.statusText || "Success",
              content: {
                [contentType]: {
                  schema: response?.body ? (() => {
                    try {
                      const parsed = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
                      return jsonToSchema(parsed);
                    } catch {
                      return { type: 'string', example: response.body };
                    }
                  })() : {}
                }
              }
            }
          }
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-1 dark:bg-[#0a0c10] overflow-y-auto selection:bg-brand-500/30">
      {/* Premium Header */}
      <div className="px-6 py-6 border-b border-surface-200 dark:border-white/[0.04] bg-gradient-to-b from-surface-50 dark:from-white/[0.02] to-transparent">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <span style={{ backgroundColor: `${methodColor}15`, color: methodColor, borderColor: `${methodColor}30` }} className="text-[9px] font-black px-2 py-0.5 rounded border uppercase font-mono tracking-widest">
                  {currentRequest.method}
                </span>
                <span className="text-[10px] font-bold text-surface-500 uppercase tracking-[0.2em]">Endpoint</span>
              </div>
              <h1 className="text-xl font-bold text-tx-primary tracking-tight leading-none uppercase italic opacity-90">{currentRequest.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-surface-200 dark:bg-white/[0.03] rounded-xl p-1 border border-surface-300 dark:border-white/[0.05] shadow-inner">
              <button
                onClick={() => setViewMode('markdown')}
                className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest ${viewMode === 'markdown' ? 'bg-white dark:bg-white/[0.08] text-tx-primary shadow-sm dark:shadow-lg' : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'}`}
              >
                Markdown
              </button>
              <button
                onClick={() => setViewMode('swagger')}
                className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest ${viewMode === 'swagger' ? 'bg-white dark:bg-white/[0.08] text-tx-primary shadow-sm dark:shadow-lg' : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'}`}
              >
                Swagger
              </button>
            </div>

            <div className="w-px h-6 bg-surface-300 dark:bg-white/[0.05] mx-1 hidden sm:block" />

            <button
              onClick={handleAIGenerate}
              disabled={isGeneratingAI}
              className="group relative flex items-center gap-2 px-4 py-2 disabled:opacity-50 text-[#111827] dark:text-gray-100 rounded-xl transition-all duration-300 overflow-hidden bg-gradient-to-b from-[#f3f4f6] via-[#d1d5db] to-[#9ca3af] dark:from-surface-500 dark:via-surface-700 dark:to-surface-900 hover:from-[#ffffff] hover:via-[#e5e7eb] hover:to-[#d1d5db] dark:hover:from-surface-400 dark:hover:via-surface-600 dark:hover:to-surface-800 border border-[#6b7280] dark:border-surface-600 shadow-[inset_0_1px_1px_rgba(255,255,255,1),inset_0_-2px_2px_rgba(0,0,0,0.2),0_4px_10px_rgba(0,0,0,0.4)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),inset_0_-2px_2px_rgba(0,0,0,0.5),0_4px_10px_rgba(0,0,0,0.6)] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.3)] dark:active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.7)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 dark:via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`${isGeneratingAI ? 'animate-spin' : 'drop-shadow-[0_1px_0_rgba(255,255,255,0.6)] dark:drop-shadow-[0_1px_0_rgba(0,0,0,0.8)]'}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-widest drop-shadow-[0_1px_0_rgba(255,255,255,0.6)] dark:drop-shadow-[0_1px_0_rgba(0,0,0,0.8)]">{isGeneratingAI ? 'Thinking...' : 'AI Documentation'}</span>
            </button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-4 rounded-2xl bg-surface-50 dark:bg-white/[0.02] border border-surface-200 dark:border-white/[0.03]">
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] text-surface-500 uppercase tracking-[0.2em] font-bold">Workspace</span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
              <span className="text-xs text-tx-secondary font-medium">{currentTeam?.name || 'Personal'}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] text-surface-500 uppercase tracking-[0.2em] font-bold">Project Scope</span>
            <span className="text-xs text-tx-secondary font-medium">{currentProject?.name || 'Unassigned'}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] text-surface-500 uppercase tracking-[0.2em] font-bold">Security</span>
            <span className="text-xs text-brand-400 font-mono font-bold uppercase tracking-tighter bg-brand-400/10 px-2 py-0.5 rounded w-fit border border-brand-400/20">
              {currentRequest.auth?.type || 'No Auth'}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] text-surface-500 uppercase tracking-[0.2em] font-bold">Maintainer</span>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-surface-200 dark:bg-surface-3 flex items-center justify-center border border-surface-300 dark:border-white/10 text-[8px] font-bold overflow-hidden">
                {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user?.name?.[0] || 'U'}
              </div>
              <span className="text-xs text-tx-secondary font-medium">{user?.name || 'Administrator'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 flex-1 flex flex-col gap-10">
        {viewMode === 'markdown' ? (
          <>
            {/* Main Content Area */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-surface-500">System Overview</h3>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 text-[10px] font-bold text-tx-secondary hover:text-brand-500 dark:hover:text-white transition-colors py-1 px-3 rounded-lg bg-surface-100 dark:bg-white/[0.03] border border-surface-200 dark:border-white/[0.05]"
                  >
                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    EDIT DOCS
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="flex flex-col gap-3">
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={12}
                    className="w-full bg-surface-50 dark:bg-[#050608] text-tx-primary dark:text-tx-secondary border border-surface-200 dark:border-white/10 rounded-xl outline-none resize-none p-5 font-mono text-sm leading-relaxed focus:border-brand-500/50 transition-all shadow-sm dark:shadow-2xl"
                    placeholder="Document your API using Markdown..."
                    spellCheck={false}
                    autoFocus
                  />
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => { setIsEditing(false); setDescription(currentRequest.description || ''); }}
                      className="px-6 py-2 text-[11px] font-bold text-surface-500 hover:text-tx-primary transition-all uppercase tracking-widest"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-8 py-2 bg-brand-500 text-white hover:bg-brand-400 font-black text-[11px] rounded-xl transition-all uppercase tracking-widest shadow-lg shadow-brand-500/20"
                    >
                      {isSaving ? 'Processing...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="group relative text-sm text-tx-secondary leading-relaxed bg-surface-50 dark:bg-[#0c0e12] border border-surface-200 dark:border-white/[0.03] p-6 rounded-2xl cursor-text hover:border-surface-300 dark:hover:border-white/10 transition-all duration-500"
                  onClick={() => setIsEditing(true)}
                >
                  <div className="prose dark:prose-invert max-w-none prose-sm opacity-90">
                    {description ? (
                      <div className="whitespace-pre-wrap">{description}</div>
                    ) : (
                      <div className="flex flex-col items-center py-10 gap-4 opacity-30 group-hover:opacity-50 transition-opacity">
                        <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-center">Empty Documentation Stack<br />Click to begin manual entry or use AI</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Technical Specification Section */}
            {!isEditing && (
              <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
                {/* Detailed Params Table */}
                {(currentRequest.headers?.filter(h => h.enabled && h.key).length > 0 || currentRequest.params?.filter(p => p.enabled && p.key).length > 0) && (
                  <div className="flex flex-col gap-4">
                    <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-surface-500">Interface Definitions</h3>
                    <div className="bg-surface-50 dark:bg-[#0c0e12] border border-surface-200 dark:border-white/[0.03] rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl">
                      <table className="w-full text-[11px] text-left border-collapse">
                        <thead>
                          <tr className="bg-surface-100 dark:bg-white/[0.02] border-b border-surface-200 dark:border-white/[0.04]">
                            <th className="px-6 py-4 text-surface-500 font-black uppercase tracking-widest w-[30%]">Variable Key</th>
                            <th className="px-6 py-4 text-surface-500 font-black uppercase tracking-widest w-[20%]">Source</th>
                            <th className="px-6 py-4 text-surface-500 font-black uppercase tracking-widest">Inferred Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-200 dark:divide-white/[0.02]">
                          {currentRequest.params?.filter(p => p.enabled && p.key).map((p, i) => (
                            <tr key={`p-${i}`} className="hover:bg-surface-100 dark:hover:bg-white/[0.01] transition-colors group">
                              <td className="px-6 py-4 font-mono text-brand-400 font-bold group-hover:pl-8 transition-all">{p.key}</td>
                              <td className="px-6 py-4">
                                <span className="bg-surface-500/10 text-surface-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter border border-surface-500/20">Query Param</span>
                              </td>
                              <td className="px-6 py-4 text-tx-secondary font-mono opacity-80 break-all">{p.value || <span className="opacity-30 italic">Dynamic</span>}</td>
                            </tr>
                          ))}
                          {currentRequest.headers?.filter(h => h.enabled && h.key).map((h, i) => (
                            <tr key={`h-${i}`} className="hover:bg-surface-100 dark:hover:bg-white/[0.01] transition-colors group">
                              <td className="px-6 py-4 font-mono text-amber-500 dark:text-amber-400 font-bold group-hover:pl-8 transition-all">{h.key}</td>
                              <td className="px-6 py-4">
                                <span className="bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter border border-amber-400/20">HTTP Header</span>
                              </td>
                              <td className="px-6 py-4 text-tx-secondary font-mono opacity-80 break-all">{h.value || <span className="opacity-30 italic">Dynamic</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Request Body Visualization */}
                {currentRequest.body?.mode !== 'none' && (
                  <div className="flex flex-col gap-4">
                    <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-surface-500">Payload Structure ({currentRequest.body?.mode})</h3>
                    <div className="bg-surface-50 dark:bg-[#0c0e12] border border-surface-200 dark:border-white/[0.03] rounded-2xl p-6 shadow-sm dark:shadow-2xl relative group">
                      <div className="absolute top-4 right-4 text-[9px] text-surface-500 dark:text-surface-600 font-mono select-none">MIME: {currentRequest.body?.mode === 'raw' ? 'application/json' : 'multipart/form-data'}</div>
                      <div className="text-xs font-mono text-brand-600 dark:text-brand-100/80 leading-relaxed overflow-x-auto">
                        {currentRequest.body?.mode === 'raw' ? (
                          <pre className="p-2">{currentRequest.body?.raw || '{}'}</pre>
                        ) : (
                          <div className="flex items-center gap-3 py-4 opacity-50">
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            <span className="text-[10px] uppercase tracking-widest font-bold">Complex form data payload detected</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* OpenAPI Export Block */}
                <div className="flex flex-col gap-4 mt-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-surface-500">Live OpenAPI Specification</h3>
                    <button
                      onClick={() => { navigator.clipboard.writeText(JSON.stringify(swaggerPreview, null, 2)); toast.success('Spec copied to clipboard'); }}
                      className="text-[9px] text-surface-500 hover:text-brand-500 dark:hover:text-white font-bold flex items-center gap-2 transition-all bg-surface-100 dark:bg-white/[0.03] px-3 py-1.5 rounded-lg border border-surface-200 dark:border-white/[0.05]"
                    >
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg> COPY JSON
                    </button>
                  </div>

                  <div
                    className="border border-surface-200 dark:border-white/[0.04] rounded-2xl overflow-hidden bg-surface-50 dark:bg-[#050608] shadow-inner"
                    style={{ height: '300px', resize: 'vertical', minHeight: '200px' }}
                  >
                    <pre className="p-6 text-[11px] font-mono text-surface-600 dark:text-surface-400 leading-normal h-full overflow-auto selection:bg-brand-500/40">
                      {JSON.stringify(swaggerPreview, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 overflow-hidden rounded-2xl border border-surface-200 dark:border-white/[0.05] bg-white dark:bg-[#0c0e12] shadow-sm dark:shadow-2xl relative animate-in zoom-in-95 duration-500">
            <div className={theme === 'dark' ? 'swagger-dark-mode' : 'swagger-light-mode'}>
              <SwaggerUI spec={swaggerPreview} />
            </div>
            {/* Simple theme override for the swagger container if it's too white in dark mode */}
            <style>{`
                .swagger-dark-mode .swagger-ui { background: #0c0e12; color: #eee; }
                .swagger-dark-mode .swagger-ui .info .title { color: #fff !important; }
                .swagger-dark-mode .swagger-ui .opblock .opblock-summary-method { border-radius: 4px; }
             `}</style>
          </div>
        )}
      </div>
    </div>
  );
}
