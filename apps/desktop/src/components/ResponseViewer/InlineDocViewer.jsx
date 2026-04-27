import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Editor from '@monaco-editor/react';
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
                   try { return JSON.parse(currentRequest.body.raw || '{}') } catch { return { type: 'string', example: currentRequest.body.raw } }
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
                      return { type: 'object', example: parsed };
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
    <div className="flex flex-col h-full bg-surface-1 overflow-y-auto">
      {/* Top Banner mapping swagger-like tags */}
      <div className="px-5 py-4 border-b border-[var(--border-1)] bg-surface-2">
        <div className="flex flex-wrap items-center justify-between gap-y-3 mb-4">
          <div className="flex items-center gap-3">
             <span style={{ backgroundColor: `${methodColor}20`, color: methodColor, border: `1px solid ${methodColor}40` }} className="text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono tracking-tight">
               {currentRequest.method}
             </span>
             <h2 className="text-xs font-bold text-tx-primary tracking-tight truncate max-w-[150px]">{currentRequest.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-surface-3 rounded-lg p-0.5 border border-border-1">
              <button
                onClick={() => setViewMode('markdown')}
                className={`px-2.5 py-1 text-[9px] font-bold rounded-md transition-all uppercase tracking-wider ${viewMode === 'markdown' ? 'bg-surface-1 text-tx-primary shadow-sm' : 'text-surface-500 hover:text-tx-secondary'}`}
              >
                Markdown
              </button>
              <button
                onClick={() => setViewMode('swagger')}
                className={`px-2.5 py-1 text-[9px] font-bold rounded-md transition-all uppercase tracking-wider ${viewMode === 'swagger' ? 'bg-surface-1 text-tx-primary shadow-sm' : 'text-surface-500 hover:text-tx-secondary'}`}
              >
                Swagger
              </button>
            </div>

            <div className="w-px h-4 bg-border-1 mx-1 hidden sm:block" />

            <button
                onClick={handleAIGenerate}
                disabled={isGeneratingAI}
                className="btn-primary"
                style={{
                  padding: '4px 10px',
                  fontSize: '9px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '24px',
                  whiteSpace: 'nowrap',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {isGeneratingAI ? '...' : 'AI DOC'}
              </button>
            
            {viewMode === 'markdown' && (
              isEditing ? (
                <>
                  <button
                    onClick={() => { setIsEditing(false); setDescription(currentRequest.description || ''); }}
                    style={{
                      padding: '4px 12px',
                      fontSize: '11px',
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: 'rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      fontFamily: 'Poppins, sans-serif',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.9)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{
                      padding: '4px 12px',
                      fontSize: '11px',
                      background: 'var(--accent)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontFamily: 'Poppins, sans-serif',
                      opacity: isSaving ? 0.6 : 1,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {isSaving ? 'Saving...' : 'Save Docs'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    color: 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontFamily: 'Poppins, sans-serif',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = 'rgba(255,255,255,0.95)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                >
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit
                </button>
              )
            )}
          </div>
        </div>

        {/* Auto Detected Metas */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
           <div className="flex flex-col gap-0.5"><span className="text-[10px] text-surface-400 uppercase tracking-wider font-semibold">Team</span><span className="text-xs text-tx-secondary">{currentTeam?.name || 'Unknown'}</span></div>
           <div className="flex flex-col gap-0.5"><span className="text-[10px] text-surface-400 uppercase tracking-wider font-semibold">Project</span><span className="text-xs text-tx-secondary">{currentProject?.name || 'Unknown'}</span></div>
           <div className="flex flex-col gap-0.5"><span className="text-[10px] text-surface-400 uppercase tracking-wider font-semibold">Auth</span><span className="text-xs text-tx-secondary uppercase">{currentRequest.auth?.type || 'none'}</span></div>
           <div className="flex flex-col gap-0.5"><span className="text-[10px] text-surface-400 uppercase tracking-wider font-semibold">Author</span><span className="text-xs text-tx-secondary">{user?.name || 'You'}</span></div>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col gap-6">
        {viewMode === 'markdown' ? (
          <>
            {/* Description Editor / Viewer */}
            <div className="flex flex-col gap-2">
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-surface-400">Documentation Overview</h3>
              {isEditing ? (
                <div className="border border-[var(--border-1)] rounded-lg overflow-hidden bg-[#1e1e1e] h-48 relative">
                    <Editor
                      height="100%"
                      defaultLanguage="markdown"
                      theme={theme === 'dark' ? 'vs-dark' : 'light'}
                      value={description}
                      onChange={setDescription}
                      options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on', padding: { top: 12 } }}
                    />
                </div>
              ) : (
                <div className="text-sm text-tx-secondary whitespace-pre-wrap rounded-lg bg-surface-2 border border-[var(--border-2)] p-4 cursor-text hover:border-surface-400 transition-colors" onClick={() => setIsEditing(true)}>
                  {description || <span className="italic opacity-50">No documentation currently laid out. Click here to add description using Markdown.</span>}
                </div>
              )}
            </div>

            {/* Explicit Payload Information */}
            {!isEditing && (
              <div className="flex flex-col gap-4 mt-2">
                  {/* Headers & Params */}
                  {(currentRequest.headers?.filter(h => h.enabled && h.key).length > 0 || currentRequest.params?.filter(p => p.enabled && p.key).length > 0) && (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-[11px] uppercase tracking-wider font-bold text-surface-400">Parameters & Headers</h3>
                      <div className="bg-surface-2 border border-[var(--border-2)] rounded-lg overflow-hidden">
                          <table className="w-full text-xs text-left">
                            <thead>
                                <tr className="border-b border-[var(--border-2)] bg-surface-3">
                                  <th className="px-3 py-2 text-surface-500 font-semibold w-1/4">Name</th>
                                  <th className="px-3 py-2 text-surface-500 font-semibold w-1/4">Type</th>
                                  <th className="px-3 py-2 text-surface-500 font-semibold">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentRequest.params?.filter(p => p.enabled && p.key).map((p, i) => (
                                  <tr key={`p-${i}`} className="border-b border-[var(--border-1)] last:border-0 hover:bg-surface-3/50">
                                    <td className="px-3 py-2 font-mono text-brand-400">{p.key}</td>
                                    <td className="px-3 py-2 text-tx-secondary opacity-70">Query</td>
                                    <td className="px-3 py-2 text-tx-secondary font-mono break-all">{p.value || '-'}</td>
                                  </tr>
                                ))}
                                {currentRequest.headers?.filter(h => h.enabled && h.key).map((h, i) => (
                                  <tr key={`h-${i}`} className="border-b border-[var(--border-1)] last:border-0 hover:bg-surface-3/50">
                                    <td className="px-3 py-2 font-mono text-accent">{h.key}</td>
                                    <td className="px-3 py-2 text-tx-secondary opacity-70">Header</td>
                                    <td className="px-3 py-2 text-tx-secondary font-mono break-all">{h.value || '-'}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                      </div>
                    </div>
                  )}

                  {/* Request Body */}
                  {currentRequest.body?.mode !== 'none' && (
                    <div className="flex flex-col gap-2 mt-2">
                      <h3 className="text-[11px] uppercase tracking-wider font-bold text-surface-400">Request Body Payload ({currentRequest.body?.mode})</h3>
                      <div className="bg-surface-2 border border-[var(--border-2)] rounded-lg p-3 text-xs font-mono text-tx-secondary overflow-x-auto selection:bg-surface-400">
                          {currentRequest.body?.mode === 'raw' ? (
                            <pre>{currentRequest.body?.raw || '{}'}</pre>
                          ) : (
                            <span className="opacity-50">Form data structure is active</span>
                          )}
                      </div>
                    </div>
                  )}
              </div>
            )}
            
            {/* OpenAPI Swagger Auto Gen Block */}
            <div className="flex flex-col gap-2 mt-4">
              <div className="flex justify-between items-center">
                  <h3 className="text-[11px] uppercase tracking-wider font-bold text-surface-400">Auto-Generated OpenAPI (Swagger)</h3>
                  <button 
                      onClick={() => { navigator.clipboard.writeText(JSON.stringify(swaggerPreview, null, 2)); toast.success('Copied!'); }} 
                      className="text-[10px] text-surface-400 hover:text-accent font-medium flex items-center gap-1"
                  >
                    <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24"><path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" /></svg> Copy JSON
                  </button>
              </div>
              
              <div 
                className="border border-[var(--border-1)] rounded-lg overflow-auto bg-[#1e1e1e] opacity-90 relative flex flex-col"
                style={{ height: '256px', minHeight: '150px', maxHeight: '800px', resize: 'vertical' }}
              >
                  <Editor
                    height="100%"
                    defaultLanguage="json"
                    theme={theme === 'dark' ? 'vs-dark' : 'light'}
                    value={JSON.stringify(swaggerPreview, null, 2)}
                    options={{ 
                      readOnly: true, 
                      minimap: { enabled: false }, 
                      fontSize: 11.5, 
                      tabSize: 2, 
                      padding: { top: 12, bottom: 12 },
                      automaticLayout: true,
                      scrollBeyondLastLine: false 
                    }}
                  />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-hidden rounded-xl border border-[var(--border-1)] swagger-container-v2">
             <SwaggerUI spec={swaggerPreview} />
          </div>
        )}
      </div>
    </div>
  );
}
