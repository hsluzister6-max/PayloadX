import { useEffect, useMemo, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { normalizeHtmlForPreview } from '@/utils/htmlNormalize.js';
import { normalizeHtmlAdaptive } from '@/utils/htmlDocumentWorkerClient.js';
import { injectPreviewBaseline, looksLikeDevServerSpa } from '@/utils/htmlPreviewBaseline.js';

/** Chromium/WebKit srcDoc practical ceiling — stay below to avoid blank iframe. */
const MAX_SRCDOC_CHARS = 2 * 1024 * 1024;

const EMPTY_IFRAME_PLACEHOLDER = '<!DOCTYPE html><html><body></body></html>';

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}

/**
 * Sandbox: lets scripts run so previews behave like a browser tab, but omits
 * `allow-same-origin` so the frame keeps an opaque origin and cannot script PayloadX.
 */
const IFRAME_SANDBOX =
  'allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox allow-pointer-lock allow-forms';

async function openUrlInSystemBrowser(url) {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (!trimmed) return;
  let href = trimmed;
  if (!/^https?:\/\//i.test(href)) {
    href = `http://${href}`;
  }
  try {
    const { open } = await import('@tauri-apps/api/shell');
    await open(href);
  } catch {
    window.open(href, '_blank', 'noopener,noreferrer');
  }
}

/**
 * @param {{ html: string, requestUrl?: string | null, className?: string }} props
 */
export default function HtmlResponsePreview({ html, requestUrl = null, className = '' }) {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';
  const [mode, setMode] = useState('preview');
  const [busy, setBusy] = useState(false);
  const [normalized, setNormalized] = useState('');
  const [error, setError] = useState(null);

  const raw = useMemo(() => (typeof html === 'string' ? html : String(html ?? '')), [html]);
  const encLen = useMemo(() => new TextEncoder().encode(raw).length, [raw]);
  const tooLarge = raw.length > MAX_SRCDOC_CHARS;
  const spaLikely = useMemo(() => looksLikeDevServerSpa(raw), [raw]);

  const previewSrcDoc = useMemo(() => {
    if (!normalized.trim()) return normalized || EMPTY_IFRAME_PLACEHOLDER;
    return injectPreviewBaseline(normalized);
  }, [normalized]);

  useEffect(() => {
    let cancelled = false;
    if (!raw.trim()) {
      setNormalized(normalizeHtmlForPreview(''));
      setBusy(false);
      setError(null);
      return undefined;
    }

    if (tooLarge) {
      setNormalized('');
      setBusy(false);
      setError(null);
      return undefined;
    }

    setBusy(true);
    setError(null);

    normalizeHtmlAdaptive(raw)
      .then((doc) => {
        if (cancelled) return;
        setNormalized(doc);
        setBusy(false);
      })
      .catch((e) => {
        if (cancelled) return;
        try {
          setNormalized(normalizeHtmlForPreview(raw));
          setError(e?.message || String(e));
        } catch {
          setNormalized('');
          setError(e?.message || String(e));
        }
        setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [raw, tooLarge]);

  const pill = (active, label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '3px 10px',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        transition: 'all 0.15s',
        fontFamily: 'Inter, sans-serif',
        background: active ? 'var(--surface-3)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
      }}
    >
      {label}
    </button>
  );

  return (
    <div className={`flex flex-col h-full min-h-0 overflow-hidden ${className}`}>
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-1)',
          background: 'var(--surface-1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 2,
            background: 'var(--surface-2)',
            borderRadius: 7,
            padding: '3px 4px',
            border: '1px solid var(--border-1)',
          }}
        >
          {pill(mode === 'preview', 'Preview', () => setMode('preview'))}
          {pill(mode === 'source', 'Source', () => setMode('source'))}
        </div>
        {requestUrl?.trim() ? (
          <button
            type="button"
            onClick={() => openUrlInSystemBrowser(requestUrl)}
            title="Open request URL in your default browser"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-1)',
              background: 'var(--surface-2)',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Open in browser
          </button>
        ) : null}
        <span
          style={{
            fontSize: 10,
            fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--text-muted)',
            marginLeft: 'auto',
          }}
        >
          {formatBytes(encLen)}
          {busy ? ' · Normalizing…' : ''}
        </span>
      </div>

      {spaLikely && mode === 'preview' && !tooLarge && (
        <div
          className="shrink-0 px-3 py-2 text-[11px] leading-snug"
          style={{
            fontFamily: 'Inter, sans-serif',
            background: isDark ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.12)',
            borderBottom: '1px solid var(--border-1)',
            color: 'var(--warning)',
          }}
        >
          This HTML looks like a <strong>Vite / ES module</strong> app. Scripts cannot resolve paths such as{' '}
          <code className="font-mono text-[10px] opacity-90">/@vite/client</code> inside this preview, so the UI may stay
          blank. Use <strong>Open in browser</strong> or load the page directly from your dev server.
        </div>
      )}

      <div className="flex-1 min-h-0 relative flex flex-col">
        {tooLarge && (
          <div
            className="flex flex-col items-center justify-center gap-2 p-6 text-center"
            style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
          >
            <p className="text-tx-secondary font-semibold max-w-md">
              HTML preview is disabled for this response ({formatBytes(encLen)} — limit{' '}
              {formatBytes(MAX_SRCDOC_CHARS)} for iframe preview).
            </p>
            <p className="text-[11px] max-w-md leading-relaxed">
              Use the <strong className="text-tx-secondary">Raw</strong> tab to view or copy the full markup.
            </p>
          </div>
        )}

        {!tooLarge && mode === 'preview' && (
          <>
            {busy && (
              <div
                className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2"
                style={{
                  background: isDark ? 'rgba(7,9,13,0.55)' : 'rgba(255,255,255,0.75)',
                  backdropFilter: 'blur(2px)',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <span className="motion-safe:animate-pulse">Preparing preview in a worker…</span>
              </div>
            )}
            {error && !busy && (
              <div
                className="shrink-0 px-3 py-2 text-[11px]"
                style={{
                  background: isDark ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.15)',
                  borderBottom: '1px solid var(--border-1)',
                  color: 'var(--warning)',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Preview used a local fallback ({error}). Document may still render.
              </div>
            )}
            <iframe
              title="HTML response preview"
              className="flex-1 min-h-[280px] w-full border-0"
              style={{
                flex: '1 1 auto',
                minHeight: 280,
                backgroundColor: '#f8fafc',
                colorScheme: 'light',
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
              }}
              sandbox={IFRAME_SANDBOX}
              referrerPolicy="no-referrer"
              srcDoc={previewSrcDoc || EMPTY_IFRAME_PLACEHOLDER}
            />
          </>
        )}

        {!tooLarge && mode === 'source' && (
          <pre
            className="response-mouse-select selectable flex-1 min-h-0 overflow-auto m-0 p-4 text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all text-tx-secondary bg-[var(--surface-1)]"
          >
            {raw}
          </pre>
        )}
      </div>
    </div>
  );
}
