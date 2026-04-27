import { useState, useMemo } from 'react';
import { useRequestStore } from '@/store/requestStore';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { getStatusClass, formatSize, formatTime, formatBody, isJson } from '@/utils/helpers';
import PostmanJsonViewer from './PostmanJsonViewer';
import JsonFormatter from './JsonFormatter';
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
  const lang = contentType.includes('json') ? 'json' : contentType.includes('xml') ? 'xml' : contentType.includes('html') ? 'html' : 'plaintext';

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
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-y-2 gap-x-3 px-3 py-2 border-b border-[var(--border-1)] bg-[var(--surface-2)]">
        <div className="flex items-center gap-2">
          <span className={`${statusClass} text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tight`}>
            {response.status} {response.statusText}
          </span>
          
          <div className="flex items-center gap-2.5 ml-1">
            <span className="text-surface-500 text-[10px] font-mono flex items-center gap-1">
              <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {formatTime(response.responseTimeMs)}
            </span>
            <span className="text-surface-500 text-[10px] font-mono flex items-center gap-1">
              <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582 4 8 4" /></svg>
              {formatSize(response.sizeBytes)}
            </span>
          </div>
        </div>

        {/* Copy button + Tabs */}
        <div className="ml-auto flex items-center gap-1">
          {/* Copy response */}
          <button
            onClick={handleCopy}
            title="Copy response"
            className="btn-ghost"
            style={{
              padding: '3px 8px',
              fontSize: '9px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              border: copied ? '1px solid var(--success)' : undefined,
              color: copied ? 'var(--success)' : undefined,
            }}
          >
            {copied ? (
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
            {copied ? 'COPIED' : 'COPY'}
          </button>

          <div className="w-px h-3 bg-border-1 mx-1" />

          {/* Tabs */}
          <div className="flex bg-surface-3 rounded-md p-0.5 border border-border-1">
            {RESPONSE_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all uppercase tracking-tight ${activeTab === tab
                    ? 'bg-surface-1 text-tx-primary shadow-sm'
                    : 'text-surface-500 hover:text-tx-secondary'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'Pretty' && (
          contentType.includes('application/json') || isJson(response.body) ? (
            <PostmanJsonViewer
              value={response.body}
              className="h-full"
            />
          ) : (
            <JsonFormatter
              value={prettyBody || response.body}
              className="h-full"
            />
          )
        )}

        {activeTab === 'Raw' && (
          <div className="h-full overflow-auto p-3">
            <pre className="text-xs text-tx-secondary font-mono whitespace-pre-wrap break-all">
              {response.body}
            </pre>
          </div>
        )}

        {activeTab === 'Headers' && (
          <div className="overflow-auto h-full p-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="text-left text-surface-500 font-semibold pb-2 pr-4 w-1/3">Header</th>
                  <th className="text-left text-surface-500 font-semibold pb-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(response.headers || {}).map(([k, v]) => (
                  <tr key={k} className="border-b border-surface-800 hover:bg-surface-800/50 transition-colors">
                    <td className="py-1.5 pr-4 font-mono text-brand-300 font-medium">{k}</td>
                    <td className="py-1.5 font-mono text-tx-secondary break-all">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'Cookies' && (
          <div className="overflow-auto h-full p-3">
            {responseCookies.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-surface-700">
                    <th className="text-left text-surface-500 font-semibold pb-2 pr-4">Name</th>
                    <th className="text-left text-surface-500 font-semibold pb-2 pr-4">Value</th>
                    <th className="text-left text-surface-500 font-semibold pb-2 pr-4">Domain</th>
                    <th className="text-left text-surface-500 font-semibold pb-2 pr-4">Path</th>
                    <th className="text-left text-surface-500 font-semibold pb-2 pr-4">Expires</th>
                    <th className="text-left text-surface-500 font-semibold pb-2">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {responseCookies.map((c) => (
                    <tr key={c.id} className="border-b border-surface-800 hover:bg-surface-800/50 transition-colors">
                      <td className="py-1.5 pr-4 font-mono text-brand-300 font-medium">{c.name}</td>
                      <td className="py-1.5 pr-4 font-mono text-tx-secondary break-all">{c.value}</td>
                      <td className="py-1.5 pr-4 font-mono text-tx-muted">{c.domain || '—'}</td>
                      <td className="py-1.5 pr-4 font-mono text-tx-muted">{c.path || '—'}</td>
                      <td className="py-1.5 pr-4 font-mono text-tx-muted">{c.expires || '—'}</td>
                      <td className="py-1.5 font-mono text-tx-muted">
                        <div className="flex gap-1">
                          {c.httpOnly && <span className="px-1 rounded bg-surface-700 text-[9px]">HttpOnly</span>}
                          {c.secure && <span className="px-1 rounded bg-surface-700 text-[9px]">Secure</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-tx-muted text-xs">
                No cookies found in response
              </div>
            )}
          </div>
        )}

        {activeTab === 'Docs' && (
          <div className="h-full overflow-hidden flex flex-col swagger-container-v2">
             <div className="flex-1 overflow-auto">
                <SwaggerUI spec={swaggerPreview} />
             </div>
          </div>
        )}

        {activeTab === 'User' && (
          <div className="overflow-auto h-full p-6 flex flex-col items-center justify-center gap-4 text-center">
             <div className="w-20 h-20 rounded-full border-2 border-[var(--border-1)] flex items-center justify-center shadow-2xl relative" style={{ background: 'var(--grad-primary)' }}>
                <span className="text-[var(--accent-text)] text-2xl font-black tracking-tighter" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {user?.name 
                    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) 
                    : 'US'
                  }
                </span>
                <div className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-success border-4 border-[var(--bg-primary)] rounded-full shadow-lg" />
             </div>
             <div className="space-y-1">
                <p className="text-lg font-bold text-tx-primary tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>{user?.name || 'SyncNest User'}</p>
                <p className="text-xs text-tx-muted font-mono">{user?.email || 'Not logged in'}</p>
             </div>
             
             <div className="w-full max-w-sm mt-4 space-y-3">
                <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700 text-left">
                   <p className="text-[10px] text-tx-muted uppercase font-bold">User Agent</p>
                   <p className="text-xs text-tx-secondary mt-1 break-all font-mono">PayloadX-API-Studio/1.3.7</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700 text-left">
                    <p className="text-[10px] text-tx-muted uppercase font-bold">Platform</p>
                    <p className="text-xs text-tx-secondary mt-1">Native Desktop</p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700 text-left">
                    <p className="text-[10px] text-tx-muted uppercase font-bold">Status</p>
                    <p className="text-xs text-success mt-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      Active Session
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
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-6">
      <div className="w-12 h-12 rounded-2xl bg-surface-800 flex items-center justify-center">
        <svg className="w-6 h-6 text-tx-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <div>
        <p className="text-surface-400 text-sm font-medium">No response yet</p>
        <p className="text-tx-muted text-xs mt-1">Press Send or ⌘+Enter to execute the request</p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-brand-500/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-500 animate-spin" />
      </div>
      <p className="text-surface-400 text-sm">Sending request...</p>
    </div>
  );
}

function ErrorState({ error }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-6">
      <div className="w-12 h-12 rounded-2xl bg-danger/10 flex items-center justify-center border border-danger/20">
        <svg className="w-6 h-6 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <p className="text-danger text-sm font-semibold">Request Error</p>
        <p className="text-surface-400 text-xs mt-1 max-w-xs">{error}</p>
      </div>
    </div>
  );
}
