import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRequestStore } from '@/store/requestStore';
import { useEnvironmentStore } from '@/store/environmentStore';
import {
  getImplicitRequestHeadersPreview,
} from '@/services/requestService';
import { tryRequestUrlCookieKey } from '@/services/requestUrlKeys';
import {
  getSavedHeadersForDomainKey,
  removeHeaderForDomain,
  saveHeaderForDomain,
} from '@/services/domainDefaultHeadersService';
import { isTauriRuntime } from '@/lib/runtime';
import toast from 'react-hot-toast';
import KeyValueDescriptionTable from './KeyValueDescriptionTable';

const COMMON_HEADERS = [
  'Accept', 'Authorization', 'Content-Type', 'Content-Length', 'User-Agent',
  'X-Requested-With', 'X-API-Key', 'X-Custom-Header', 'Cache-Control', 'Origin',
];

const COOKIE_PREVIEW_MAX = 4;

export default function HeadersTab() {
  const { currentRequest, updateField } = useRequestStore();
  const { resolveVariables } = useEnvironmentStore();
  const headers = currentRequest.headers || [];
  const [showAutoHeaders, setShowAutoHeaders] = useState(false);
  const [jarCookies, setJarCookies] = useState({ loading: false, names: [] });
  /** Bumps when domain default headers in localStorage change (save or other tab). */
  const [domainStorageTick, setDomainStorageTick] = useState(0);

  const setHeaders = (h) => updateField('headers', h);

  const resolvedUrlPreview = useMemo(() => {
    try {
      const u = resolveVariables(currentRequest.url || '');
      return u?.trim() ? u : null;
    } catch {
      const raw = (currentRequest.url || '').trim();
      return raw || null;
    }
  }, [currentRequest.url, resolveVariables]);

  const implicitRows = useMemo(
    () =>
      getImplicitRequestHeadersPreview({
        headers: currentRequest.headers,
        method: currentRequest.method,
        body: currentRequest.body,
        auth: currentRequest.auth,
        resolveVariables,
        resolvedUrl: resolvedUrlPreview,
      }),
    [
      currentRequest.headers,
      currentRequest.method,
      currentRequest.body,
      currentRequest.auth,
      resolveVariables,
      resolvedUrlPreview,
    ],
  );

  useEffect(() => {
    if (implicitRows.length === 0) setShowAutoHeaders(false);
  }, [implicitRows.length]);

  const cookieHost = useMemo(() => {
    const raw = currentRequest.url || '';
    const resolved = resolveVariables(raw);
    return tryRequestUrlCookieKey(resolved) || tryRequestUrlCookieKey(raw);
  }, [currentRequest.url, resolveVariables]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'payloadx_domain_default_headers_v1') setDomainStorageTick((t) => t + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const savedByHeaderNameLower = useMemo(() => {
    const m = new Map();
    if (!cookieHost) return m;
    for (const { key, value } of getSavedHeadersForDomainKey(cookieHost)) {
      const name = String(key ?? '').trim();
      if (!name) continue;
      m.set(name.toLowerCase(), { key: name, value: String(value ?? '') });
    }
    return m;
  }, [cookieHost, domainStorageTick]);

  const getDomainPinStatus = useCallback(
    (row) => {
      const name = String(row.key ?? '').trim();
      if (!name || !cookieHost) return 'none';
      const saved = savedByHeaderNameLower.get(name.toLowerCase());
      if (!saved) return 'unsaved';
      let resolvedVal;
      try {
        resolvedVal = resolveVariables(String(row.value ?? ''));
      } catch {
        resolvedVal = String(row.value ?? '');
      }
      return saved.value === resolvedVal ? 'saved' : 'dirty';
    },
    [cookieHost, savedByHeaderNameLower, resolveVariables],
  );

  const handleToggleHeaderForDomain = useCallback(
    (row) => {
      const host = tryRequestUrlCookieKey(resolveVariables(currentRequest.url || ''))
        || tryRequestUrlCookieKey(currentRequest.url || '');
      if (!host) {
        toast.error('Set a URL with a host (e.g. https://api.example.com/...)');
        return;
      }
      const name = String(row.key ?? '').trim();
      if (!name) return;
      const pin = getDomainPinStatus(row);
      if (pin === 'saved') {
        removeHeaderForDomain(host, name);
        toast.success(`Removed «${name}» from saved defaults for ${host}`);
      } else {
        saveHeaderForDomain(host, name, resolveVariables(String(row.value ?? '')));
        toast.success(`Saved «${name}» for ${host}`);
      }
      setDomainStorageTick((t) => t + 1);
    },
    [currentRequest.url, resolveVariables, getDomainPinStatus],
  );

  useEffect(() => {
    if (!isTauriRuntime() || !cookieHost) {
      setJarCookies({ loading: false, names: [] });
      return undefined;
    }
    let cancelled = false;
    setJarCookies({ loading: true, names: [] });
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/tauri');
        const c = await invoke('get_cookies', { host: cookieHost });
        const names = c && typeof c === 'object' ? Object.keys(c).sort() : [];
        if (!cancelled) setJarCookies({ loading: false, names });
      } catch {
        if (!cancelled) setJarCookies({ loading: false, names: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cookieHost]);

  const sessionDotClass = jarCookies.loading
    ? 'bg-[var(--warning)] animate-pulse'
    : jarCookies.names.length > 0
      ? 'bg-[var(--success)]'
      : 'bg-[var(--border-2)]';

  const cookieStatusLine = (() => {
    if (!isTauriRuntime()) {
      return 'Cookie jar / session: desktop app only — browser builds do not merge saved cookies into requests.';
    }
    if (!cookieHost) {
      return 'Cookie jar / session: enter a URL (with host) to see whether saved cookies will be sent.';
    }
    if (jarCookies.loading) {
      return (
        <>
          Cookie jar / session: checking <code className="text-[10px] px-0.5 rounded bg-[var(--surface-2)]">{cookieHost}</code>…
        </>
      );
    }
    if (jarCookies.names.length === 0) {
      return (
        <>
          No active cookie keys for{' '}
          <code className="text-[10px] px-0.5 rounded bg-[var(--surface-2)]">{cookieHost}</code>
          — the <code className="text-[10px]">Cookie</code> header will not be added from the jar on Send.
        </>
      );
    }
    const shown = jarCookies.names.slice(0, COOKIE_PREVIEW_MAX);
    const rest = jarCookies.names.length - shown.length;
    return (
      <>
        Session / cookies <span className="text-tx-muted font-normal">(jar)</span>:{' '}
        <code className="text-[10px] px-0.5 rounded bg-[var(--surface-2)]">{cookieHost}</code>
        {' — '}
        <span className="font-mono text-[10px] text-tx-secondary">{shown.join(', ')}</span>
        {rest > 0 ? ` +${rest} more` : ''}
      </>
    );
  })();

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 border-b border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 space-y-2">
        <div className="flex flex-wrap items-start gap-2 justify-between">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <span
              className={`mt-1 shrink-0 w-2 h-2 rounded-full ${sessionDotClass}`}
              title={jarCookies.names.length > 0 ? 'Cookie jar has keys for this host' : 'No jar keys for this host'}
              aria-hidden
            />
            <p className="text-[11px] text-tx-secondary leading-relaxed min-w-0">
              {cookieStatusLine}
            </p>
          </div>
          {implicitRows.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAutoHeaders((v) => !v)}
              className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] text-tx-primary hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              {showAutoHeaders ? 'Hide automatic headers' : 'Show automatic headers'}
            </button>
          )}
        </div>

        {showAutoHeaders && implicitRows.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-[var(--border-1)]/80">
            <p className="text-[10px] text-tx-muted/90 leading-relaxed">
              Merged by the client or inferred from Auth / Body. Domain headers you save with the bookmark column apply on Send for the same host/port unless you set the same key below. Add the same key in the table below to override tunnel
              helpers; an enabled <code className="text-[10px]">Authorization</code> header overrides the Auth tab.
            </p>
            <div className="rounded-md border border-[var(--border-1)] bg-[var(--surface-2)]/40 overflow-hidden">
              <div
                className="grid text-[10px] font-bold uppercase tracking-[0.07em] text-tx-muted border-b border-[var(--border-1)] bg-[var(--surface-2)]/60"
                style={{ gridTemplateColumns: 'minmax(100px,1fr) minmax(120px,1.2fr) minmax(140px,1.4fr)' }}
              >
                <div className="py-1.5 px-2">Key</div>
                <div className="py-1.5 px-2">Value</div>
                <div className="py-1.5 px-2">Source</div>
              </div>
              <div className="max-h-[min(200px,30vh)] overflow-y-auto">
                {implicitRows.map((row) => (
                  <div
                    key={`${row.key}-${row.source}`}
                    className="grid border-b border-[var(--border-1)] last:border-0 text-[11px] leading-snug hover:bg-[var(--surface-2)]/25"
                    style={{ gridTemplateColumns: 'minmax(100px,1fr) minmax(120px,1.2fr) minmax(140px,1.4fr)' }}
                  >
                    <div className="py-2 px-2 font-mono text-[var(--accent)] font-semibold break-all">{row.key}</div>
                    <div className="py-2 px-2 font-mono text-tx-secondary break-all">{row.value}</div>
                    <div className="py-2 px-2 text-tx-muted text-[10px] leading-relaxed">{row.source}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <datalist id="common-headers">
          {COMMON_HEADERS.map((h) => (
            <option key={h} value={h} />
          ))}
        </datalist>
        <KeyValueDescriptionTable
          title="Headers"
          items={headers}
          onItemsChange={setHeaders}
          keyPlaceholder="Key"
          valuePlaceholder="Value"
          descriptionPlaceholder="Description"
          datalistId="common-headers"
          domainKey={cookieHost}
          onToggleHeaderForDomain={handleToggleHeaderForDomain}
          getDomainPinStatus={getDomainPinStatus}
        />
      </div>
    </div>
  );
}
