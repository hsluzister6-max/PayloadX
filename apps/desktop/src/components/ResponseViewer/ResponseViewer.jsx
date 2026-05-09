import { useState, useMemo, lazy, Suspense } from 'react';
import { useRequestStore } from '@/store/requestStore';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { getStatusClass, formatSize, formatTime, formatBody, getResponseContentType, getQuotaExceededHint } from '@/utils/helpers';
import { isRealHttpStatus, parseTransportError } from '@/utils/transportErrors';
import JsonEditor from '../RequestBuilder/tabs/JsonEditor';
import JsonTreeViewer from './JsonTreeViewer';
import VirtualizedResponseText from './VirtualizedResponseText.jsx';
const ResponseMonacoViewer = lazy(() => import('./ResponseMonacoViewer.jsx'));
import { RAW_VIRTUAL_MIN_CHARS, MONACO_RAW_MIN_CHARS } from '@/utils/responseViewThresholds';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import './swagger-theme.css';

const RESPONSE_TABS = ['Pretty', 'Raw', 'Headers', 'Cookies', 'Docs', 'User'];
/** Swagger `useMemo` must not parse multi-megabyte bodies on the main thread (DMG / release WebKit). */
const MAX_SWAGGER_EMBED_CHARS = 80_000;

export default function ResponseViewer() {
  const { response, isExecuting, currentRequest } = useRequestStore();
  const { theme } = useUIStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('Pretty');
  const [copied, setCopied] = useState(false);
  const [responseLanguage, setResponseLanguage] = useState(null);

  const contentType = getResponseContentType(response?.headers);

  // ── Construct Swagger Spec ──────────────────────────────────────────────
  const swaggerPreview = useMemo(() => {
    if (!currentRequest) return null;

    const rawBody = currentRequest.body?.mode === 'raw' ? (currentRequest.body.raw || '') : '';
    const requestJsonSchema =
      currentRequest.body?.mode === 'raw'
        ? (() => {
            if (rawBody.length > MAX_SWAGGER_EMBED_CHARS) {
              return { type: 'object', description: 'Request body too large for Docs preview.' };
            }
            try {
              return JSON.parse(rawBody || '{}');
            } catch {
              return { type: 'string', example: rawBody };
            }
          })()
        : (currentRequest.body?.mode === 'form-data' || currentRequest.body?.mode === 'urlencoded')
          ? {
              type: 'object',
              properties: (currentRequest.body.mode === 'form-data'
                ? (currentRequest.body.formData || [])
                : (currentRequest.body.urlencoded || []))
                .filter((i) => i.enabled && i.key)
                .reduce((acc, i) => ({ ...acc, [i.key]: { type: 'string', example: i.value } }), {}),
            }
          : {};

    const responseSchemaForDocs = () => {
      const b = response?.body;
      if (b == null || b === '') return {};
      if (typeof b === 'string') {
        if (b.length > MAX_SWAGGER_EMBED_CHARS) {
          return {
            type: 'object',
            description: 'Response body is large; Docs omits the example. Use Pretty or Raw.',
          };
        }
        try {
          return { type: 'object', example: JSON.parse(b) };
        } catch {
          return { type: 'string', example: b };
        }
      }
      try {
        return { type: 'object', example: b };
      } catch {
        return { type: 'string' };
      }
    };

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
                  schema: requestJsonSchema,
                }
              }
            } : undefined,
            responses: {
              [response?.status || '200']: {
                description: response?.statusText || "Success",
                content: {
                  [contentType || "application/json"]: {
                    schema: responseSchemaForDocs(),
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

  if (!isRealHttpStatus(response.status)) {
    return <TransportErrorView response={response} />;
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
      {/* ── Compact single-row header ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 10px', borderBottom: '1px solid var(--border-1)',
        background: 'var(--surface-1)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        {/* Left: tab pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--surface-2)', borderRadius: 7, padding: '3px 4px', border: '1px solid var(--border-1)' }}>
          {RESPONSE_TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '3px 9px', borderRadius: 5, border: 'none', cursor: 'pointer',
                fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                transition: 'all 0.15s', fontFamily: 'Inter, sans-serif',
                background: activeTab === tab ? 'var(--surface-3)' : 'transparent',
                color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                boxShadow: activeTab === tab ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Center: status / time / size badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          {/* Status */}
          <span style={{
            fontSize: 10, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.02em',
            padding: '2px 7px', borderRadius: 5,
            background: response.status >= 200 && response.status < 300 ? 'rgba(74,222,128,0.1)' : response.status >= 400 ? 'rgba(248,113,113,0.1)' : 'rgba(251,191,36,0.1)',
            color: response.status >= 200 && response.status < 300 ? 'var(--success)' : response.status >= 400 ? 'var(--error)' : 'var(--warning)',
            border: `1px solid ${response.status >= 200 && response.status < 300 ? 'rgba(74,222,128,0.25)' : response.status >= 400 ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.25)'}`,
          }}>
            {response.status} {response.statusText}
          </span>
          {/* Time */}
          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: 5, background: 'var(--surface-2)', border: '1px solid var(--border-1)' }}>
            ⏱ {formatTime(response.responseTimeMs)}
          </span>
          {/* Size */}
          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: 5, background: 'var(--surface-2)', border: '1px solid var(--border-1)' }}>
            ⬇ {formatSize(response.sizeBytes)}
          </span>
        </div>

        {/* Right: icon-only action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
          {/* Copy */}
          <button
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy response'}
            style={iconBtn(copied)}
          >
            {copied
              ? <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              : <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            }
          </button>
          {/* Download */}
          <button
            onClick={() => {
              const blob = new Blob([response.body || ''], { type: 'text/plain' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
              a.download = 'response.json'; a.click();
            }}
            title="Download response"
            style={iconBtn()}
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
        </div>
      </div>


      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'Pretty' && (
          <JsonTreeViewer
            value={typeof response.body === 'string' ? response.body : JSON.stringify(response.body)}
            contentType={contentType}
            className="h-full"
          />
        )}

        {activeTab === 'Raw' && (
          <div className="h-full min-h-0 overflow-hidden p-4 bg-[var(--surface-1)] flex flex-col response-mouse-select">
            {typeof response.body === 'string' && response.body.length >= MONACO_RAW_MIN_CHARS ? (
              <div className="flex-1 min-h-0 flex flex-col">
                <p className="text-[10px] text-tx-muted mb-2 shrink-0">
                  Large response — code editor view (virtualized). Pretty tab still uses tree / workers for JSON under the size caps.
                </p>
                <div className="flex-1 min-h-0">
                  <Suspense fallback={(
                    <div className="h-full min-h-[200px] flex items-center justify-center text-tx-muted text-xs bg-[var(--surface-1)] rounded-md border border-[var(--border-1)]">
                      Loading code editor…
                    </div>
                  )}
                  >
                    <ResponseMonacoViewer
                      value={response.body}
                      language={/json|ndjson|javascript/i.test(contentType || '') ? 'json' : 'plaintext'}
                    />
                  </Suspense>
                </div>
              </div>
            ) : typeof response.body === 'string' && response.body.length > RAW_VIRTUAL_MIN_CHARS ? (
              <VirtualizedResponseText text={response.body} />
            ) : (
              <pre className="selectable text-xs text-tx-secondary font-mono whitespace-pre-wrap break-all leading-relaxed h-full overflow-auto cursor-text">
                {response.body}
              </pre>
            )}
          </div>
        )}

        {activeTab === 'Headers' && (
          <div className="overflow-auto h-full p-4 bg-[var(--surface-1)] response-mouse-select">
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
          <div className="overflow-auto h-full p-4 bg-[var(--surface-1)] response-mouse-select">
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
    <div className="flex flex-col items-center justify-center h-full gap-6 bg-[var(--bg-primary)] px-6">
      <div
        className="h-9 w-9 rounded-full border-2 border-[var(--border-1)] border-t-[var(--accent)] motion-safe:animate-spin motion-reduce:animate-none"
        role="status"
        aria-label="Loading response"
      />
      <div className="flex flex-col items-center gap-1 text-center max-w-xs">
        <p className="text-sm font-semibold text-tx-secondary" style={{ fontFamily: 'Syne, sans-serif' }}>
          Loading response
        </p>
        <p className="text-xs text-tx-muted font-medium leading-relaxed">
          This may take a moment depending on the server and payload size.
        </p>
      </div>
    </div>
  );
}

function TransportErrorView({ response }) {
  const [copied, setCopied] = useState(false);
  const parsed = response?.clientError || parseTransportError(response?.error || response?.body || '');
  const quotaHint = getQuotaExceededHint(parsed.raw);
  const textToCopy = response?.body || parsed.raw;
  const isCancelled = parsed.code === 'CANCELLED';

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 10px',
          borderBottom: '1px solid var(--border-1)',
          background: 'var(--surface-1)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 900,
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.02em',
            padding: '2px 7px',
            borderRadius: 5,
            background: isCancelled ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)',
            color: isCancelled ? 'var(--warning)' : 'var(--error)',
            border: `1px solid ${isCancelled ? 'rgba(251,191,36,0.28)' : 'rgba(248,113,113,0.28)'}`,
          }}
        >
          {isCancelled ? 'Cancelled' : 'Error'}
          {!isCancelled && parsed.code ? ` · ${parsed.code}` : ''}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          No HTTP response (client / transport)
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: 5, background: 'var(--surface-2)', border: '1px solid var(--border-1)', marginLeft: 4 }}>
          ⏱ {formatTime(response?.responseTimeMs)}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(textToCopy).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            title={copied ? 'Copied!' : 'Copy error details'}
            style={iconBtn(copied)}
          >
            {copied
              ? <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              : <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto w-full">
          <p className="text-[10px] font-bold uppercase tracking-widest text-tx-muted mb-2">Could not complete request</p>
          <h2 className="text-lg font-bold text-tx-primary mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
            {parsed.headline}
          </h2>
          <p className="text-sm text-tx-secondary leading-relaxed mb-4">
            {parsed.summary}
          </p>
          {parsed.hints.length > 0 && (
            <div className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] p-4 mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-tx-muted mb-2">What to try</p>
              <ul className="text-xs text-tx-secondary space-y-2 list-disc pl-4">
                {parsed.hints.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {quotaHint && (
            <p className="text-xs text-tx-secondary border border-[var(--border-1)] rounded-lg p-3 bg-[var(--surface-2)] mb-4 leading-relaxed">
              {quotaHint}
            </p>
          )}
          <p className="text-[10px] font-bold uppercase tracking-widest text-tx-muted mb-1">Technical detail</p>
          <pre className="selectable cursor-text text-[11px] font-mono text-tx-secondary whitespace-pre-wrap break-all leading-relaxed p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-1)]">
            {parsed.raw}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── Style helper ──────────────────────────────────────────────────────────────
function iconBtn(active) {
  return {
    width: 26, height: 26,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active ? 'rgba(74,222,128,0.1)' : 'transparent',
    border: `1px solid ${active ? 'var(--success)' : 'transparent'}`,
    borderRadius: 6, cursor: 'pointer',
    color: active ? 'var(--success)' : 'var(--text-muted)',
    transition: 'all 0.15s',
  };
}
