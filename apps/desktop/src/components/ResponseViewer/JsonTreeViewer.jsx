import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useUIStore } from '@/store/uiStore';
import { buildLines, collectPaths, buildNdjsonTreeLines, collectNdjsonPaths } from '@/utils/jsonTreeLines';
import { normalizeResponseBodyText, parseJsonFamily } from '@/utils/jsonResponseParse';
import { parseResponseInWorker, shouldParseResponseInWorker } from '@/utils/responseWorkerClient';
import { buildTreeLinesInWorker, shouldUseTreeLinesWorker } from '@/utils/treeLinesWorkerClient';
import VirtualizedResponseText from './VirtualizedResponseText.jsx';
const ResponseMonacoViewer = lazy(() => import('./ResponseMonacoViewer.jsx'));
import { RAW_VIRTUAL_MIN_CHARS, MONACO_RAW_MIN_CHARS } from '@/utils/responseViewThresholds';

/**
 * PayloadX High-Performance JSON Viewer
 *
 * - Standard JSON, NDJSON, JSON-seq (Content-Type aware)
 * - Tree layout (incl. NDJSON / JSON-seq): Web Worker when payload ≥ ~40KB serialized,
 *   otherwise sync on the main thread (lower latency for tiny responses). Worker + module
 *   workers work across Tauri (WebKit / WebView2) and browsers.
 * - Virtualized rendering for huge payloads (800+ lines)
 * - Search, expand/collapse, per-row copy
 */

const ROW_H = 22;
const OVERSCAN = 10;
const VTHRESH = 600; // lines before switching to virtual scroll
const INDENT_PX = 14;
/** Above this, Raw sub-tab virtualizes so a single-line/minified body does not freeze WebKit. */
const RAW_VIRTUAL_THRESHOLD = RAW_VIRTUAL_MIN_CHARS;
const PRETTY_TEXT_MAX_LINES = 300_000;

function textToSyntheticTreeLines(strings) {
  return strings.map((raw, i) => ({
    depth: 0,
    path: `~${i}`,
    col: false,
    col2: false,
    raw,
    parts: [{ t: 'key', s: raw }],
  }));
}

/** Main-thread tree build (small payloads + worker fallback). */
function buildTreeLinesSync(parsed, parseFormat, collapsed) {
  const stream =
    (parseFormat === 'ndjson' || parseFormat === 'json-seq') &&
    Array.isArray(parsed);
  if (stream) {
    return buildNdjsonTreeLines(parsed, collapsed);
  }
  return buildLines(parsed, 'root', 0, false, collapsed);
}

// ── Syntax colors ────────────────────────────────────────────────────────────
const PALETTES = {
  dark: {
    key: '#C8CDD8',   // platinum
    str: '#86EFAC',   // emerald
    num: '#93C5FD',   // azure
    bool: '#FDE047',   // gold
    null: '#94A3B8',   // slate
    bkt: 'rgba(255,255,255,0.4)', // bracket
    pun: 'rgba(255,255,255,0.2)', // punctuation / comma
    dim: 'rgba(255,255,255,0.18)', // collapsed preview
  },
  light: {
    key: '#0366d6',   // dark blue
    str: '#22863a',   // darker green
    num: '#005cc5',   // deep blue
    bool: '#d73a49',   // red/pink
    null: '#6a737d',   // grey
    bkt: 'rgba(0,0,0,0.5)', 
    pun: 'rgba(0,0,0,0.3)',
    dim: 'rgba(0,0,0,0.25)',
  }
};

function formatSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

// ── Single Row Component ──────────────────────────────────────────────────────
function Row({ ln, lineNum, isHit, isCurrent, onToggle, style, colors, theme }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ln.raw).catch(() => {
      const ta = document.createElement('textarea'); ta.value = ln.raw;
      ta.style.cssText = 'position:fixed;opacity:0;'; document.body.appendChild(ta);
      ta.focus(); ta.select(); try { document.execCommand('copy'); } catch (_) { }
      document.body.removeChild(ta);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [ln.raw]);

  const isDark = theme === 'dark';

  if (ln.isDivider) {
    return (
      <div
        style={{
          ...(style || {}),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: ROW_H,
          fontSize: 10,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: '0.06em',
          color: colors.dim,
          userSelect: 'none',
          background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
        }}
        className="json-row"
      >
        <span>{ln.dividerLabel || '──'}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        height: ROW_H,
        fontSize: 11.5,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        cursor: 'text',
        userSelect: 'text',
        WebkitUserSelect: 'text',
        background: isCurrent
          ? (isDark ? 'rgba(251,191,36,0.18)' : 'rgba(251,191,36,0.25)')
          : isHit
            ? (isDark ? 'rgba(251,191,36,0.07)' : 'rgba(251,191,36,0.12)')
            : 'transparent',
        paddingRight: 4,
      }}
      className="json-row"
    >
      {/* Line number */}
      <div
        className="json-lineno"
        onClick={() => ln.col && onToggle(ln.path)}
        style={{
          width: 48, minWidth: 48, textAlign: 'right', paddingRight: 10,
          color: colors.dim, borderRight: `0.5px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
          fontSize: 10.5, cursor: ln.col ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 2, height: '100%', flexShrink: 0, userSelect: 'none', WebkitUserSelect: 'none',
        }}
      >
        {ln.col && (
          <span style={{ width: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' }}>
            {ln.col2 ? '›' : '⌄'}
          </span>
        )}
        <span>{lineNum + 1}</span>
      </div>

      {/* Content */}
      <div
        className="json-row-content selectable"
        style={{
          paddingLeft: 6 + ln.depth * INDENT_PX, flex: 1, whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: ROW_H + 'px',
          cursor: 'text', userSelect: 'text', WebkitUserSelect: 'text',
        }}
      >
        {ln.parts.map((p, i) => (
          <span key={i} style={{ color: colors[p.t] || colors.dim }}>{p.s}</span>
        ))}
      </div>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        title="Copy line"
        className="json-copy-btn"
        style={{
          width: 26, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#4ade80' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'),
          flexShrink: 0, fontSize: 12, transition: 'color 0.15s',
        }}
      >
        {copied ? '✓' : '⎘'}
      </button>
    </div>
  );
}

// ── Virtual Scroller ──────────────────────────────────────────────────────────
function VirtualScroller({ lines, searchHits, searchIdx, onToggle, colors, theme }) {
  const outerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const fn = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', fn, { passive: true });
    return () => el.removeEventListener('scroll', fn);
  }, []);

  // Scroll to current search hit
  useEffect(() => {
    if (!searchHits.length || !outerRef.current) return;
    const targetIdx = searchHits[searchIdx];
    outerRef.current.scrollTop = Math.max(0, (targetIdx - 5) * ROW_H);
  }, [searchIdx, searchHits]);

  const hitSet = useMemo(() => new Set(searchHits), [searchHits]);
  const curHit = searchHits[searchIdx];

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(lines.length - 1, Math.ceil((scrollTop + height) / ROW_H) + OVERSCAN);
  const totalH = lines.length * ROW_H;

  return (
    <div ref={outerRef} className="response-mouse-select" style={{ height: '100%', overflow: 'auto', position: 'relative' }}>
      <div style={{ height: totalH, position: 'relative' }}>
        {lines.slice(start, end + 1).map((ln, idx) => {
          const i = start + idx;
          return (
            <Row
              key={i}
              ln={ln}
              lineNum={i}
              isHit={hitSet.has(i)}
              isCurrent={i === curHit}
              onToggle={onToggle}
              colors={colors}
              theme={theme}
              style={{ position: 'absolute', top: i * ROW_H, left: 0, right: 0 }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Flat Scroller (small payloads) ────────────────────────────────────────────
function FlatScroller({ lines, searchHits, searchIdx, onToggle, colors, theme }) {
  const hitSet = useMemo(() => new Set(searchHits), [searchHits]);
  const curHit = searchHits[searchIdx];
  const ref = useRef(null);

  // Scroll to current hit
  useEffect(() => {
    if (!searchHits.length || !ref.current) return;
    const el = ref.current.querySelector(`[data-row="${searchHits[searchIdx]}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [searchIdx, searchHits]);

  return (
    <div ref={ref} className="response-mouse-select" style={{ height: '100%', overflow: 'auto' }}>
      {lines.map((ln, i) => (
        <div key={i} data-row={i}>
          <Row
            ln={ln}
            lineNum={i}
            isHit={hitSet.has(i)}
            isCurrent={i === curHit}
            onToggle={onToggle}
            colors={colors}
            theme={theme}
          />
        </div>
      ))}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function JsonTreeViewer({ value, contentType = '', className = '' }) {
  const [parsed, setParsed] = useState(null);
  const [parseFormat, setParseFormat] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [parseBusy, setParseBusy] = useState(false);
  const [rawStr, setRawStr] = useState('');
  /** tree = collapsible JSON tree; prettyText = large-response pretty lines (no IPC clone of full object graph). */
  const [displayMode, setDisplayMode] = useState('tree');
  const [prettyText, setPrettyText] = useState('');
  const [collapsed, setCollapsed] = useState(new Set());
  /** Set when worker caps NDJSON / JSON-seq record count */
  const [streamRecordCap, setStreamRecordCap] = useState(null);
  const [tab, setTab] = useState('pretty'); // 'pretty' | 'raw'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState([]);
  const [searchIdx, setSearchIdx] = useState(0);
  const searchRef = useRef(null);
  /** Tree rows built off-thread (or sync when tiny) */
  const [treeLines, setTreeLines] = useState([]);
  const [treeLinesBusy, setTreeLinesBusy] = useState(false);

  const collapsedKey = useMemo(
    () => [...collapsed].sort().join('\n'),
    [collapsed],
  );

  useEffect(() => {
    let cancelled = false;
    if (value == null || value === '') {
      setParsed(null);
      setParseFormat(null);
      setParseError(null);
      setParseBusy(false);
      setRawStr('');
      setDisplayMode('tree');
      setPrettyText('');
      setStreamRecordCap(null);
      setTreeLines([]);
      setTreeLinesBusy(false);
      return undefined;
    }

    const asStr = typeof value === 'string' ? value : JSON.stringify(value);
    const normalized = normalizeResponseBodyText(asStr);
    setRawStr(asStr);
    setCollapsed(new Set());
    setSearchQuery('');
    setSearchHits([]);
    setSearchIdx(0);
    setDisplayMode('tree');
    setPrettyText('');
    setStreamRecordCap(null);
    setTreeLines([]);
    setTreeLinesBusy(false);

    const runSync = () => {
      const result = parseJsonFamily(normalized, contentType);
      if (cancelled) return;
      if (!result.ok) {
        setParsed(null);
        setParseFormat(null);
        setParseError(result.error);
        return;
      }
      setParseError(null);
      setParseFormat(result.format);
      if (result.format === 'empty') {
        setParsed(null);
        return;
      }
      setParsed(result.value);
    };

    if (shouldParseResponseInWorker(normalized)) {
      setParseBusy(true);
      setParseError(null);
      setParsed(null);
      setParseFormat(null);
      parseResponseInWorker(normalized, contentType)
        .then((payload) => {
          if (cancelled) return;
          setParseBusy(false);
          setParseError(null);
          const {
            format,
            displayMode: dm = 'tree',
            value: v,
            prettyText: pt = '',
            ndjsonTruncated = null,
          } = payload;
          setParseFormat(format);
          setStreamRecordCap(ndjsonTruncated || null);
          if (format === 'empty') {
            setParsed(null);
            setDisplayMode('tree');
            setPrettyText('');
            setStreamRecordCap(null);
            return;
          }
          if (dm === 'prettyText') {
            setDisplayMode('prettyText');
            setPrettyText(pt);
            setParsed(null);
            setCollapsed(new Set());
            return;
          }
          setDisplayMode('tree');
          setPrettyText('');
          setParsed(v);
        })
        .catch((e) => {
          if (cancelled) return;
          try {
            const result = parseJsonFamily(normalized, contentType);
            if (result.ok && result.format !== 'empty') {
              setParseBusy(false);
              setParseError(null);
              setParseFormat(result.format);
              setDisplayMode('tree');
              setPrettyText('');
              setStreamRecordCap(null);
              setParsed(result.value);
              return;
            }
          } catch {
            /* ignore */
          }
          setParseBusy(false);
          setParsed(null);
          setPrettyText('');
          setDisplayMode('tree');
          setParseFormat(null);
          setStreamRecordCap(null);
          setParseError(e?.message || String(e));
        });
    } else {
      setParseBusy(false);
      runSync();
    }

    return () => {
      cancelled = true;
    };
  }, [value, contentType]);

  const prettyLines = useMemo(() => {
    if (displayMode !== 'prettyText' || !prettyText) return [];
    const parts = prettyText.split('\n');
    if (parts.length <= PRETTY_TEXT_MAX_LINES) return parts;
    return [
      ...parts.slice(0, PRETTY_TEXT_MAX_LINES),
      `… [truncated ${parts.length - PRETTY_TEXT_MAX_LINES} lines — use Download for full body]`,
    ];
  }, [displayMode, prettyText]);

  useEffect(() => {
    if (parseBusy || parseError || parseFormat == null || parseFormat === 'empty') {
      setTreeLines([]);
      setTreeLinesBusy(false);
      return;
    }
    if (displayMode !== 'tree' || parsed == null) {
      setTreeLines([]);
      setTreeLinesBusy(false);
      return;
    }

    const collapsedPaths = collapsedKey ? collapsedKey.split('\n') : [];
    let cancelled = false;

    const applySync = () => {
      try {
        const built = buildTreeLinesSync(parsed, parseFormat, collapsed);
        if (!cancelled) {
          setTreeLines(built);
          setTreeLinesBusy(false);
        }
      } catch {
        if (!cancelled) {
          setTreeLines([]);
          setTreeLinesBusy(false);
        }
      }
    };

    if (!shouldUseTreeLinesWorker(parsed, parseFormat)) {
      setTreeLinesBusy(false);
      applySync();
      return () => {
        cancelled = true;
      };
    }

    setTreeLinesBusy(true);
    buildTreeLinesInWorker(parsed, parseFormat, collapsedPaths)
      .then((built) => {
        if (cancelled) return;
        setTreeLines(built);
        setTreeLinesBusy(false);
      })
      .catch(() => {
        if (cancelled) return;
        applySync();
      });

    return () => {
      cancelled = true;
    };
  }, [parsed, parseFormat, displayMode, parseBusy, parseError, collapsedKey]);

  const lines = useMemo(() => {
    if (parseBusy || parseError || parseFormat == null || parseFormat === 'empty') return [];
    if (displayMode === 'prettyText') {
      if (!prettyLines.length) return [];
      return textToSyntheticTreeLines(prettyLines);
    }
    return treeLines;
  }, [displayMode, prettyLines, treeLines, parseFormat, parseBusy, parseError]);

  // Search
  useEffect(() => {
    if (!searchQuery || !lines.length) { setSearchHits([]); setSearchIdx(0); return; }
    const q = searchQuery.toLowerCase();
    const hits = lines.reduce((acc, ln, i) => { if (ln.raw.toLowerCase().includes(q)) acc.push(i); return acc; }, []);
    setSearchHits(hits);
    setSearchIdx(0);
  }, [searchQuery, lines]);

  const handleToggle = useCallback((path) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => setCollapsed(new Set()), []);

  const handleCollapseAll = useCallback(() => {
    if (parseFormat == null || parseFormat === 'empty' || displayMode !== 'tree' || parsed == null) {
      return;
    }
    if ((parseFormat === 'ndjson' || parseFormat === 'json-seq') && Array.isArray(parsed)) {
      setCollapsed(collectNdjsonPaths(parsed));
      return;
    }
    setCollapsed(collectPaths(parsed, 'root'));
  }, [parsed, parseFormat, displayMode]);

  const handleCopyAll = useCallback(() => {
    navigator.clipboard.writeText(rawStr).catch(() => { });
  }, [rawStr]);

  const handleSearchNav = useCallback((dir) => {
    if (!searchHits.length) return;
    setSearchIdx(i => (i + dir + searchHits.length) % searchHits.length);
  }, [searchHits]);

  const { theme } = useUIStore();
  const colors = PALETTES[theme] || PALETTES.dark;

  const sizeLabel = useMemo(() => rawStr ? formatSize(new TextEncoder().encode(rawStr).length) : '', [rawStr]);
  const streamFormatLabel =
    parseFormat === 'ndjson' ? 'NDJSON'
      : parseFormat === 'json-seq' ? 'JSON-seq'
        : null;

  const isDark = theme === 'dark';

  // ── Render ────────────────────────────────────────────────────────────────
  if (value == null || value === '') {
    return (
      <div className={`flex items-center justify-center h-full ${className}`} style={{ color: 'rgba(255,255,255,0.15)', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
        No response body
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full response-mouse-select ${className}`} style={{ background: 'transparent', overflow: 'hidden' }}>
      {/* ── Minimal Floating Controls ─────────────────────────────────────── */}
      {lines.length > 0 && !parseBusy && (
        <div style={{
          position: 'absolute', top: 6, right: 14, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 4,
          background: isDark ? 'rgba(7, 9, 13, 0.85)' : 'rgba(255, 255, 255, 0.9)', 
          backdropFilter: 'blur(4px)',
          padding: '4px', borderRadius: 8, 
          border: `0.5px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.1)'}`,
          boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {streamFormatLabel && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
              padding: '2px 6px', borderRadius: 4,
              background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)',
              color: isDark ? '#A5B4FC' : '#4338CA',
              marginRight: 2,
            }}>
              {streamFormatLabel}
            </span>
          )}
          {/* Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: 6, color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)', fontSize: 11, pointerEvents: 'none' }}>⌕</span>
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSearchNav(e.shiftKey ? -1 : 1);
                if (e.key === 'Escape') { setSearchQuery(''); }
              }}
              placeholder="search..."
              style={{
                fontSize: 10, padding: '2px 36px 2px 20px',
                borderRadius: 4, border: 'none',
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', 
                color: isDark ? '#D0D4DE' : '#111827',
                fontFamily: 'inherit', width: 100, outline: 'none',
                transition: 'width 0.2s',
              }}
              onFocus={e => e.target.style.width = '140px'}
              onBlur={e => e.target.style.width = '100px'}
            />
            {searchHits.length > 0 && (
              <span style={{ position: 'absolute', right: 6, fontSize: 9, color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }}>
                {searchIdx + 1}/{searchHits.length}
              </span>
            )}
          </div>

          <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />

          {displayMode === 'prettyText' && (
            <span
              title="Tree view skipped for this size to keep the app stable"
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '2px 6px',
                borderRadius: 4,
                background: isDark ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.2)',
                color: isDark ? '#FBBF24' : '#B45309',
                marginRight: 2,
              }}
            >
              Large response
            </span>
          )}

          {displayMode === 'tree' && (
            <>
              <button onClick={handleExpandAll} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', padding: '2px 4px', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color=isDark?'rgba(255,255,255,0.8)':'rgba(0,0,0,0.8)'} onMouseLeave={e => e.currentTarget.style.color=isDark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.4)'} title="Expand all">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              <button onClick={handleCollapseAll} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', padding: '2px 4px', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color=isDark?'rgba(255,255,255,0.8)':'rgba(0,0,0,0.8)'} onMouseLeave={e => e.currentTarget.style.color=isDark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.4)'} title="Collapse all">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
              </button>
            </>
          )}
        </div>
      )}

      {streamRecordCap && !parseBusy && (
        <div
          style={{
            flexShrink: 0,
            padding: '6px 12px',
            fontSize: 11,
            lineHeight: 1.45,
            color: isDark ? 'rgba(251,191,36,0.95)' : '#92400E',
            background: isDark ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.15)',
            borderBottom: `1px solid ${isDark ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.25)'}`,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Showing {streamRecordCap.shown.toLocaleString()} of {streamRecordCap.total.toLocaleString()} NDJSON / JSON-seq records in the viewer. Download the response for the full stream.
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {tab === 'raw' && (
          rawStr.length >= MONACO_RAW_MIN_CHARS ? (
            <div className="h-full min-h-0 p-3 flex flex-col response-mouse-select">
              <p className="text-[10px] text-tx-muted mb-1.5 shrink-0">
                Large body — editor view. Switch to Pretty for tree when the payload is within parser limits.
              </p>
              <div className="flex-1 min-h-0">
                <Suspense fallback={(
                  <div className="h-full min-h-[160px] flex items-center justify-center text-tx-muted text-[11px] bg-[var(--surface-1)] rounded-md border border-[var(--border-1)]">
                    Loading editor…
                  </div>
                )}
                >
                  <ResponseMonacoViewer
                    value={rawStr}
                    language={/json|ndjson|javascript/i.test(contentType || '') ? 'json' : 'plaintext'}
                  />
                </Suspense>
              </div>
            </div>
          ) : rawStr.length > RAW_VIRTUAL_THRESHOLD ? (
            <div className="h-full min-h-0 p-3 response-mouse-select">
              <VirtualizedResponseText text={rawStr} textClass="text-[11.5px] font-mono text-tx-secondary whitespace-pre-wrap break-all leading-snug" />
            </div>
          ) : (
            <div className="response-mouse-select selectable" style={{ height: '100%', overflow: 'auto', padding: 12, fontSize: 11.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#C8CDD8', fontFamily: "'JetBrains Mono', monospace", cursor: 'text' }}>
              {rawStr}
            </div>
          )
        )}

        {tab === 'pretty' && parseBusy && (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)', fontSize: 12, fontFamily: 'Inter, sans-serif',
          }}>
            <span style={{ fontSize: 22, opacity: 0.7 }}>⏳</span>
            <span>Parsing large response in a worker…</span>
            {sizeLabel ? <span style={{ fontSize: 10, opacity: 0.75 }}>{sizeLabel}</span> : null}
          </div>
        )}

        {tab === 'pretty' && !parseBusy && !parseError && treeLinesBusy && displayMode === 'tree' && parsed != null && (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)', fontSize: 12, fontFamily: 'Inter, sans-serif',
            position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 22, opacity: 0.7 }}>⚡</span>
            <span>Building tree in a worker…</span>
            {sizeLabel ? <span style={{ fontSize: 10, opacity: 0.75 }}>{sizeLabel}</span> : null}
          </div>
        )}

        {tab === 'pretty' && !parseBusy && parseError && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#F87171', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
            <span style={{ fontSize: 24 }}>⚠</span>
            <span style={{ opacity: 0.8, maxWidth: 360, textAlign: 'center', lineHeight: 1.5 }}>{parseError}</span>
            <button type="button" onClick={() => setTab('raw')} style={{ ...btnStyle(), marginTop: 4 }}>view raw</button>
          </div>
        )}

        {tab === 'pretty' && !parseBusy && !parseError && parsed === null && parseFormat === 'empty' && (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.35)', fontSize: 13, fontFamily: 'Inter, sans-serif',
          }}>
            Empty body
          </div>
        )}

        {tab === 'pretty' && !parseBusy && !parseError && parsed === null && parseFormat == null && value !== '' && value != null && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
            Parsing…
          </div>
        )}

        {tab === 'pretty' && !parseBusy && !parseError && lines.length > 0 && (
          <div className="response-mouse-select" style={{ height: '100%', overflow: 'hidden' }}>
            {/* Row hover style via <style> injection to avoid inline-on-each-row overhead */}
            <style>{`.json-row:hover{background:${isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)'}!important}.json-copy-btn:hover{color:${isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'}!important}`}</style>
            {lines.length > VTHRESH ? (
              <VirtualScroller lines={lines} searchHits={searchHits} searchIdx={searchIdx} onToggle={handleToggle} colors={colors} theme={theme} />
            ) : (
              <FlatScroller lines={lines} searchHits={searchHits} searchIdx={searchIdx} onToggle={handleToggle} colors={colors} theme={theme} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function badgeStyle(bg, color) {
  return {
    fontSize: 11, padding: '2px 7px', borderRadius: 5,
    background: bg || 'rgba(255,255,255,0.06)', color: color || 'rgba(255,255,255,0.35)',
    whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif',
  };
}
function btnStyle() {
  return {
    fontSize: 11, padding: '3px 8px', borderRadius: 5,
    border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent',
    color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
    fontFamily: 'Inter, sans-serif', transition: 'color 0.15s',
  };
}
function iconBtnStyle() {
  return {
    position: 'absolute', right: 2, background: 'none', border: 'none',
    cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: '0 2px',
  };
}
