import { useState, useMemo } from 'react';
import { useRequestStore } from '@/store/requestStore';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { getStatusClass, formatSize, formatTime, formatBody } from '@/utils/helpers';
import JsonEditor from '../RequestBuilder/tabs/JsonEditor';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import './swagger-theme.css';

const RESPONSE_TABS = ['Pretty', 'Raw', 'Headers', 'Cookies', 'Docs', 'User'];

export default function ResponseViewer() {
  const { response, isExecuting, currentRequest } = useRequestStore();
  const { theme } = useUIStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('Pretty');
  const [copied, setCopied] = useState(false);
  const [responseLanguage, setResponseLanguage] = useState(null);

  const contentType = response?.headers?.['content-type'] || '';

  // ── Construct Swagger Spec ──────────────────────────────────────────────
  const swaggerPreview = useMemo(() => {
    if (!currentRequest) return null;

    return {
      openapi: "3.0.0",
      info: {
        title: currentRequest.name || "API Request",
        description: currentRequest.description || "Auto-generated documentation from PayloadX",
        version: "1.0.0"
      },
      servers: [
        { url: "/", description: "Relative Path" }
      ],
      paths: {
        [currentRequest.url?.split('?')[0] || '/']: {
          [(currentRequest.method || 'GET').toLowerCase()]: {
            summary: currentRequest.name,
            parameters: [
              ...(currentRequest.params?.filter(p => p.enabled && p.key).map(p => ({
                name: p.key,
                in: "query",
                schema: { type: "string", default: p.value }
              })) || []),
              ...(currentRequest.headers?.filter(h => h.enabled && h.key).map(h => ({
                name: h.key,
                in: "header",
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
                  [contentType || "application/json"]: {
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
  }, [currentRequest, response, contentType]);

  if (isExecuting) {
    return <LoadingState />;
  }

  if (!response) {
    return <EmptyState />;
  }

  if (response.error && response.status === 0) {
    return <ErrorState error={response.error} />;
  }

  const prettyBody = formatBody(response.body, contentType);
  const statusClass = getStatusClass(response.status);
  const autoLang = contentType.includes('json') ? 'json' : contentType.includes('xml') ? 'xml' : contentType.includes('html') ? 'html' : 'plaintext';
  const lang = responseLanguage || autoLang;

  const handleCopy = () => {
    let text = '';
    if (activeTab === 'Headers') {
      text = JSON.stringify(response.headers || {}, null, 2);
    } else if (activeTab === 'Cookies') {
      const cookiesHeader = response.headers?.['set-cookie'] || response.headers?.['Set-Cookie'] || '';
      text = cookiesHeader;
    } else if (activeTab === 'Pretty') {
      text = prettyBody;
    } else {
      text = response.body || '';
    }
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const parseCookies = (setCookieHeader) => {
    if (!setCookieHeader) return [];
    const cookieStrings = setCookieHeader.split('\n');
    return cookieStrings.map((str, index) => {
      const parts = str.split(';').map(p => p.trim());
      const [nameValue, ...attrs] = parts;
      const eqIdx = nameValue.indexOf('=');
      const name = eqIdx > -1 ? nameValue.slice(0, eqIdx) : nameValue;
      const value = eqIdx > -1 ? nameValue.slice(eqIdx + 1) : '';

      const cookie = {
        id: index,
        name,
        value,
        domain: '',
        path: '',
        expires: '',
        httpOnly: false,
        secure: false
      };

      attrs.forEach(attr => {
        const [k, v] = attr.split('=').map(p => p.trim());
        const key = k.toLowerCase();
        if (key === 'domain') cookie.domain = v || '';
        else if (key === 'path') cookie.path = v || '';
        else if (key === 'expires') cookie.expires = v || '';
        else if (key === 'httponly') cookie.httpOnly = true;
        else if (key === 'secure') cookie.secure = true;
      });

      return cookie;
    });
  };

  const responseCookies = parseCookies(response.headers?.['set-cookie'] || response.headers?.['Set-Cookie'] || '');

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Postman-style Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-1)] bg-[var(--surface-2)] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex bg-[var(--surface-3)] rounded-lg p-1 border border-[var(--border-1)]">
            {RESPONSE_TABS.slice(0, 4).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-md text-[10px] font-black transition-all uppercase tracking-tight ${activeTab === tab
                    ? 'bg-[var(--bg-primary)] text-[var(--accent)] shadow-glass border border-[var(--border-2)]'
                    : 'text-surface-500 hover:text-tx-secondary'
                  }`}
              >
                {tab}
              </button>
            ))}
            <div className="w-px h-3 bg-[var(--border-2)] mx-1 self-center" />
             {RESPONSE_TABS.slice(4).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-md text-[10px] font-black transition-all uppercase tracking-tight ${activeTab === tab
                    ? 'bg-[var(--bg-primary)] text-[var(--accent)] shadow-glass border border-[var(--border-2)]'
                    : 'text-surface-500 hover:text-tx-secondary'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex items-center gap-3 py-1 px-3 rounded-full bg-[var(--surface-1)] border border-[var(--border-1)]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-surface-500 uppercase tracking-tighter">Status:</span>
                <span className={`text-[11px] font-black ${response.status >= 200 && response.status < 300 ? 'text-green-500' : 'text-red-500'}`}>
                  {response.status} {response.statusText}
                </span>
              </div>
              <div className="w-px h-3 bg-[var(--border-2)]" />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-surface-500 uppercase tracking-tighter">Time:</span>
                <span className="text-[11px] font-black text-tx-secondary font-mono">
                  {formatTime(response.responseTimeMs)}
                </span>
              </div>
              <div className="w-px h-3 bg-[var(--border-2)]" />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-surface-500 uppercase tracking-tighter">Size:</span>
                <span className="text-[11px] font-black text-tx-secondary font-mono">
                  {formatSize(response.sizeBytes)}
                </span>
              </div>
           </div>
           
           <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-3)] hover:bg-[var(--surface-4)] border border-[var(--border-2)] text-[10px] font-black text-tx-secondary transition-all"
           >
             {copied ? <span className="text-green-500">COPIED</span> : <>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                COPY
             </>}
           </button>
        </div>
      </div>

      {/* Sub-toolbar for Pretty view */}
      {activeTab === 'Pretty' && (
        <div className="flex items-center gap-4 px-4 py-2 border-b border-[var(--border-1)] bg-[var(--bg-secondary)]/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-surface-500 uppercase tracking-tighter">Display:</span>
            <select 
              value={lang}
              onChange={(e) => setResponseLanguage(e.target.value)}
              className="bg-[var(--surface-1)] border border-[var(--border-2)] rounded px-2 py-0.5 text-[10px] font-bold text-tx-primary outline-none hover:border-[var(--accent)] transition-colors"
            >
              <option value="json">JSON</option>
              <option value="xml">XML</option>
              <option value="html">HTML</option>
              <option value="text">Text</option>
            </select>
          </div>
          
          <div className="w-px h-3 bg-[var(--border-2)]" />
          
          <button 
            onClick={() => {
              const event = new KeyboardEvent('keydown', { key: 'f', keyCode: 70, ctrlKey: true, metaKey: true, bubbles: true });
              document.dispatchEvent(event);
            }}
            className="flex items-center gap-1.5 text-surface-500 hover:text-[var(--accent)] text-[10px] font-black uppercase tracking-widest transition-colors"
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            Find
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'Pretty' && (
          <JsonEditor
            value={prettyBody}
            language={lang}
            readOnly={true}
            hideHeader={true}
            className="h-full border-none rounded-none"
          />
        )}

        {activeTab === 'Raw' && (
          <div className="h-full overflow-auto p-4 bg-[var(--surface-1)]">
            <pre className="text-xs text-tx-secondary font-mono whitespace-pre-wrap break-all leading-relaxed">
              {response.body}
            </pre>
          </div>
        )}

        {activeTab === 'Headers' && (
          <div className="overflow-auto h-full p-4 bg-[var(--surface-1)]">
            <div className="max-w-3xl">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-1)]">
                    <th className="text-left text-surface-500 font-black pb-3 pr-4 uppercase tracking-widest">Header Key</th>
                    <th className="text-left text-surface-500 font-black pb-3 uppercase tracking-widest">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(response.headers || {}).map(([k, v]) => (
                    <tr key={k} className="border-b border-[var(--border-1)] hover:bg-[var(--surface-2)] transition-colors">
                      <td className="py-2.5 pr-4 font-mono text-[var(--accent)] font-bold">{k}</td>
                      <td className="py-2.5 font-mono text-tx-secondary break-all">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Cookies' && (
          <div className="overflow-auto h-full p-4 bg-[var(--surface-1)]">
            {responseCookies.length > 0 ? (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[var(--border-1)]">
                    <th className="text-left text-surface-500 font-black pb-3 pr-4 uppercase tracking-widest">Name</th>
                    <th className="text-left text-surface-500 font-black pb-3 pr-4 uppercase tracking-widest">Value</th>
                    <th className="text-left text-surface-500 font-black pb-3 pr-4 uppercase tracking-widest">Domain</th>
                    <th className="text-left text-surface-500 font-black pb-3 pr-4 uppercase tracking-widest">Path</th>
                    <th className="text-left text-surface-500 font-black pb-3 pr-4 uppercase tracking-widest">Expires</th>
                    <th className="text-left text-surface-500 font-black pb-3 uppercase tracking-widest">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {responseCookies.map((c) => (
                    <tr key={c.id} className="border-b border-[var(--border-1)] hover:bg-[var(--surface-2)] transition-colors">
                      <td className="py-2.5 pr-4 font-mono text-[var(--accent)] font-bold">{c.name}</td>
                      <td className="py-2.5 pr-4 font-mono text-tx-secondary break-all">{c.value}</td>
                      <td className="py-2.5 pr-4 font-mono text-tx-muted">{c.domain || '—'}</td>
                      <td className="py-2.5 pr-4 font-mono text-tx-muted">{c.path || '—'}</td>
                      <td className="py-2.5 pr-4 font-mono text-tx-muted">{c.expires || '—'}</td>
                      <td className="py-2.5 font-mono text-tx-muted">
                        <div className="flex gap-1">
                          {c.httpOnly && <span className="px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[9px] font-bold">HttpOnly</span>}
                          {c.secure && <span className="px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[9px] font-bold">Secure</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-tx-muted text-sm italic font-medium opacity-50">
                No cookies found in response
              </div>
            )}
          </div>
        )}

        {activeTab === 'Docs' && (
          <div className="h-full overflow-hidden flex flex-col bg-[var(--surface-1)]">
             <div className="flex-1 overflow-auto p-4">
                <SwaggerUI spec={swaggerPreview} />
             </div>
          </div>
        )}

        {activeTab === 'User' && (
          <div className="overflow-auto h-full p-8 flex flex-col items-center justify-center gap-6 text-center bg-[var(--surface-1)]">
             <div className="w-24 h-24 rounded-full border-4 border-[var(--border-1)] flex items-center justify-center shadow-2xl relative bg-gradient-to-br from-[var(--accent)] to-[var(--accent-text)]">
                <span className="text-[var(--bg-primary)] text-3xl font-black tracking-tighter" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {user?.name 
                    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) 
                    : 'US'
                  }
                </span>
                <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-[var(--bg-primary)] rounded-full shadow-lg" />
             </div>
             <div className="space-y-1">
                <p className="text-2xl font-black text-tx-primary tracking-tighter uppercase" style={{ fontFamily: 'Syne, sans-serif' }}>{user?.name || 'PayloadX User'}</p>
                <p className="text-xs text-tx-muted font-mono tracking-widest">{user?.email || 'OFFLINE SESSION'}</p>
             </div>
             
             <div className="w-full max-w-sm mt-4 space-y-4">
                <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-1)] text-left shadow-sm">
                   <p className="text-[10px] text-surface-500 uppercase font-black tracking-widest">Client Engine</p>
                   <p className="text-xs text-tx-secondary mt-1 break-all font-mono font-bold">PayloadX-API-Studio/1.4.2 (Desktop)</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-1)] text-left shadow-sm">
                    <p className="text-[10px] text-surface-500 uppercase font-black tracking-widest">Connection</p>
                    <p className="text-xs text-tx-secondary mt-1 font-bold">Native Bridge</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-1)] text-left shadow-sm">
                    <p className="text-[10px] text-surface-500 uppercase font-black tracking-widest">Status</p>
                    <p className="text-xs text-green-500 mt-1 flex items-center gap-2 font-bold">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      ACTIVE
                    </p>
                  </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8 bg-[var(--bg-primary)]">
      <div className="w-16 h-16 rounded-3xl bg-[var(--surface-2)] flex items-center justify-center border border-[var(--border-1)] shadow-sm">
        <svg className="w-8 h-8 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <div>
        <p className="text-tx-secondary text-base font-black tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>READY FOR ACTION</p>
        <p className="text-surface-500 text-xs mt-2 font-medium">Press Send or ⌘+Enter to fetch response data</p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 bg-[var(--bg-primary)] relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[var(--accent)]/5 rounded-full blur-3xl animate-pulse" />
      
      {/* Stylish Radar/Ring Loader */}
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Outer dashed orbit */}
        <div className="absolute inset-0 rounded-full border border-[var(--accent)]/20 border-dashed animate-[spin_8s_linear_infinite]" />
        
        {/* Middle fast scanner ring */}
        <div className="absolute inset-2 rounded-full border border-[var(--border-1)] border-t-[var(--accent)] animate-[spin_1.5s_cubic-bezier(0.4,0,0.2,1)_infinite]" />
        <div className="absolute inset-2 rounded-full border border-transparent border-b-[var(--accent)]/50 animate-[spin_2s_linear_infinite_reverse]" />
        
        {/* Inner solid orbit */}
        <div className="absolute inset-5 rounded-full border border-[var(--accent)]/10 bg-[var(--surface-2)]/50 backdrop-blur-md shadow-[inset_0_0_12px_rgba(255,255,255,0.02)]" />
        
        {/* Core 'X' Logo */}
        <div className="relative z-10 flex items-center justify-center animate-pulse">
           <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#metal-grad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 8px rgba(200,205,216,0.5))' }}>
             <defs>
               <linearGradient id="metal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                 <stop offset="0%" stopColor="#f5f7fa" />
                 <stop offset="35%" stopColor="#8e93a0" />
                 <stop offset="65%" stopColor="#e4e7ec" />
                 <stop offset="100%" stopColor="#6b7280" />
               </linearGradient>
             </defs>
             <line x1="18" y1="6" x2="6" y2="18"></line>
             <line x1="6" y1="6" x2="18" y2="18"></line>
           </svg>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5 z-10">
        <p className="text-sm font-black tracking-widest uppercase drop-shadow-md" style={{ fontFamily: 'Syne, sans-serif' }}>
          <span style={{ backgroundImage: 'var(--grad-logo)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Payload</span>
          <span style={{ backgroundImage: 'var(--grad-chrome)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 4px rgba(200,205,216,0.4))' }}>X</span>
        </p>
        <p className="text-tx-muted text-[10px] font-mono uppercase tracking-[0.3em] animate-pulse">
          Establishing Connection...
        </p>
      </div>
    </div>
  );
}

function ErrorState({ error }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8 bg-[var(--bg-primary)]">
      <div className="w-16 h-16 rounded-3xl bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-sm">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <p className="text-red-500 text-base font-black tracking-tight uppercase" style={{ fontFamily: 'Syne, sans-serif' }}>Request Failed</p>
        <p className="text-surface-500 text-xs mt-2 max-w-xs font-medium leading-relaxed italic">{error}</p>
      </div>
    </div>
  );
}
