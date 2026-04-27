/**
 * PostmanJsonViewer.jsx — High-performance JSON viewer
 *
 * Architecture decisions:
 *
 *   1. useJsonWorker  → JSON.parse runs in a Web Worker (off main thread).
 *      If window.__TAURI__ is present, tries the native Rust `parse_json`
 *      command first (serde_json), falls back to worker.
 *
 *   2. Lazy buildLines → Only EXPANDED subtrees are traversed.
 *      Default: every object/array starts COLLAPSED.
 *      Initial render cost = O(top-level keys), not O(all nodes).
 *
 *   3. useVirtualList → ~40 DOM nodes in view at any time regardless of
 *      total line count (handles 100k+ lines smoothly).
 *
 *   4. Search → debounced 200ms, O(n) scan once, O(1) hit lookup via Set,
 *      prev/next via sorted hitIndices[].
 *
 *   5. ≥ 5MB → default Raw; Pretty requires explicit opt-in click.
 */

import {
  useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect, memo,
} from 'react';
import { useUIStore }     from '@/store/uiStore';
import { useJsonWorker }  from './hooks/useJsonWorker';
import { useVirtualList } from './hooks/useVirtualList';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROW_H              = 22;         // px — every row is exactly this height
const OVERSCAN           = 8;          // extra rows rendered above/below viewport
const HUGE               = 5_000_000; // 5 MB threshold
const SEARCH_DEBOUNCE_MS = 200;

// ─── Colour palettes ──────────────────────────────────────────────────────────
const LIGHT = { key: '#185FA5', str: '#639922', num: '#BA7517', bool: '#534AB7', null: '#534AB7', bkt: '#3B6D11', pun: '#555', dim: '#999' };
const DARK  = { key: '#85B7EB', str: '#97C459', num: '#EF9F27', bool: '#AFA9EC', null: '#AFA9EC', bkt: '#5DCAA5', pun: '#ccc',  dim: '#6e7681' };

// ─── Utilities ────────────────────────────────────────────────────────────────
function esc(s) {
  return s
    .replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
}

function formatSize(n) {
  if (n < 1024)      return `${n}B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1_048_576).toFixed(2)}MB`;
}

/** Cross-platform clipboard — falls back to execCommand for Tauri/WebView. */
function copyText(text) {
  return navigator.clipboard.writeText(text).catch(() => {
    const ta = Object.assign(document.createElement('textarea'), {
      value: text,
      style: 'position:fixed;opacity:0',
    });
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
  });
}

// ─── Lazy line builder ────────────────────────────────────────────────────────
/**
 * buildLines — flattens a JSON subtree into display rows.
 *
 * CRITICAL INVARIANT: if a path is NOT in `expandedPaths`, this function
 * emits exactly 1 summary row and DOES NOT recurse into children.
 * That means on first load (expandedPaths = empty Set) the entire tree is
 * treated as collapsed → cost is O(Object.keys(root)).
 */
function buildLines(v, path, depth, expandedPaths, trail, keyLabel = null) {
  const kParts  = keyLabel ? [{ t: 'key', s: keyLabel }, { t: 'pun', s: ': ' }] : [];
  const tParts  = trail   ? [{ t: 'pun', s: ',' }]                               : [];
  const rawKey  = keyLabel ? `${keyLabel}: ` : '';
  const trailCh = trail ? ',' : '';

  // Primitives ─────────────────────────────────────────────────────────────────
  if (v === null)        return [{ depth, path, canExpand: false, isOpen: false, raw: `${rawKey}null${trailCh}`,       parts: [...kParts, { t: 'null', s: 'null'       }, ...tParts] }];
  if (v === true || v === false) { const s = String(v); return [{ depth, path, canExpand: false, isOpen: false, raw: `${rawKey}${s}${trailCh}`, parts: [...kParts, { t: 'bool', s }, ...tParts] }]; }
  if (typeof v === 'number')     { const s = String(v); return [{ depth, path, canExpand: false, isOpen: false, raw: `${rawKey}${s}${trailCh}`, parts: [...kParts, { t: 'num',  s }, ...tParts] }]; }
  if (typeof v === 'string') {
    const s = `"${esc(v)}"`;
    return [{ depth, path, canExpand: false, isOpen: false, raw: `${rawKey}${s}${trailCh}`, parts: [...kParts, { t: 'str', s }, ...tParts] }];
  }

  // Array ───────────────────────────────────────────────────────────────────────
  if (Array.isArray(v)) {
    if (!v.length) return [{ depth, path, canExpand: false, isOpen: false, raw: `${rawKey}[]${trailCh}`, parts: [...kParts, { t: 'bkt', s: '[]' }, ...tParts] }];

    if (!expandedPaths.has(path)) {
      // Collapsed — single summary line, zero child traversal
      const label = `…${v.length} item${v.length !== 1 ? 's' : ''}`;
      return [{ depth, path, canExpand: true, isOpen: false, raw: `${rawKey}[${label}]${trailCh}`, parts: [...kParts, { t: 'bkt', s: '[' }, { t: 'dim', s: label }, { t: 'bkt', s: ']' }, ...tParts] }];
    }

    const ls = [{ depth, path, canExpand: true, isOpen: true, raw: `${rawKey}[`, parts: [...kParts, { t: 'bkt', s: '[' }] }];
    for (let i = 0; i < v.length; i++) ls.push(...buildLines(v[i], `${path}[${i}]`, depth + 1, expandedPaths, i < v.length - 1));
    ls.push({ depth, path, canExpand: true, isOpen: false, raw: `]${trailCh}`, parts: [{ t: 'bkt', s: ']' }, ...tParts] });
    return ls;
  }

  // Object ──────────────────────────────────────────────────────────────────────
  if (typeof v === 'object') {
    const keys = Object.keys(v);
    if (!keys.length) return [{ depth, path, canExpand: false, isOpen: false, raw: `${rawKey}{}${trailCh}`, parts: [...kParts, { t: 'bkt', s: '{}' }, ...tParts] }];

    if (!expandedPaths.has(path)) {
      // Collapsed — preview up to 3 key names
      const preview = keys.slice(0, 3).join(', ') + (keys.length > 3 ? ', …' : '');
      return [{ depth, path, canExpand: true, isOpen: false, raw: `${rawKey}{${preview}}${trailCh}`, parts: [...kParts, { t: 'bkt', s: '{' }, { t: 'dim', s: preview }, { t: 'bkt', s: '}' }, ...tParts] }];
    }

    const ls = [{ depth, path, canExpand: true, isOpen: true, raw: `${rawKey}{`, parts: [...kParts, { t: 'bkt', s: '{' }] }];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      ls.push(...buildLines(v[k], `${path}.${k}`, depth + 1, expandedPaths, i < keys.length - 1, `"${esc(k)}"`));
    }
    ls.push({ depth, path, canExpand: true, isOpen: false, raw: `}${trailCh}`, parts: [{ t: 'bkt', s: '}' }, ...tParts] });
    return ls;
  }

  return [];
}

/**
 * collectAllExpandable — full DFS to find every path that can be expanded.
 * ONLY called when user clicks "Expand All"; never runs at initial load.
 */
function collectAllExpandable(v, path, out = new Set()) {
  if (v === null || typeof v !== 'object') return out;
  if (Array.isArray(v)) {
    if (v.length) { out.add(path); v.forEach((x, i) => collectAllExpandable(x, `${path}[${i}]`, out)); }
  } else {
    const ks = Object.keys(v);
    if (ks.length) { out.add(path); ks.forEach(k => collectAllExpandable(v[k], `${path}.${k}`, out)); }
  }
  return out;
}

// ─── Memoised row component ───────────────────────────────────────────────────
const JsonRow = memo(function JsonRow({ line, index, colors, isHit, isCurrent, onToggle, onCopy, copiedIdx }) {
  const [hov, setHov] = useState(false);
  const copied = copiedIdx === index;

  let bg = 'transparent';
  if (isCurrent) bg = 'rgba(250,199,117,0.35)';
  else if (isHit) bg = 'rgba(250,238,218,0.20)';
  else if (hov)   bg = 'rgba(128,128,128,0.10)';

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', height: ROW_H,
        fontSize: 11.5, fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        backgroundColor: bg, paddingRight: 4,
      }}
    >
      {/* Gutter: line number + chevron */}
      <div
        onClick={line.canExpand ? onToggle : undefined}
        style={{
          width: 52, minWidth: 52, textAlign: 'right', paddingRight: 10,
          color: 'var(--color-text-tertiary, #aaa)',
          borderRight: '1px solid var(--border-1, #333)',
          fontSize: 10.5, cursor: line.canExpand ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 2, height: '100%', userSelect: 'none',
        }}
      >
        {line.canExpand && (
          <span style={{
            width: 10, display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0, fontSize: 9,
            transform: line.isOpen ? 'none' : 'rotate(-90deg)',
            transition: 'transform 0.12s ease',
          }}>⌄</span>
        )}
        <span>{index + 1}</span>
      </div>

      {/* Content — userSelect: text so mouse can select & copy any token */}
      <div style={{
        paddingLeft: 6 + line.depth * 14, flex: 1,
        whiteSpace: 'pre', overflow: 'hidden',
        textOverflow: 'ellipsis', lineHeight: `${ROW_H}px`,
        userSelect: 'text', cursor: 'text',
      }}>
        {line.parts.map((p, i) => (
          <span key={i} style={{ color: colors[p.t] ?? colors.pun }}>{p.s}</span>
        ))}
      </div>

      {/* Copy-line button */}
      <button
        onClick={e => { e.stopPropagation(); onCopy(line.raw, index); }}
        title="Copy line"
        style={{
          width: 24, height: ROW_H, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hov ? 1 : 0, background: 'none', border: 'none',
          cursor: 'pointer', fontSize: 12,
          transition: 'opacity 0.1s',
          color: copied ? '#4caf50' : 'var(--color-text-tertiary, #aaa)',
        }}
      >
        {copied ? '✓' : '⎘'}
      </button>
    </div>
  );
});

// ─── Virtualised list ─────────────────────────────────────────────────────────
function VirtualJsonList({ lines, colors, hitSet, hitIndices, searchIdx, onToggle, onCopy, copiedIdx, scrollRef }) {
  const { containerRef, startIdx, endIdx, totalHeight } = useVirtualList({
    count: lines.length, itemHeight: ROW_H, overscan: OVERSCAN,
  });

  // Expose the raw scrolling container so external logic (like search) can manipulate scrollTop
  useLayoutEffect(() => {
    if (scrollRef) scrollRef.current = containerRef.current;
  }, [scrollRef, containerRef]);

  return (
    <div ref={containerRef} style={{ height: '100%', overflow: 'auto', position: 'relative' }}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        {lines.slice(startIdx, endIdx + 1).map((ln, offset) => {
          const idx       = startIdx + offset;
          const isHit     = hitSet.has(idx);
          const isCurrent = isHit && hitIndices[searchIdx] === idx;
          return (
            <div key={idx} style={{ position: 'absolute', top: idx * ROW_H, left: 0, right: 0, height: ROW_H }}>
              <JsonRow
                line={ln} index={idx} colors={colors}
                isHit={isHit} isCurrent={isCurrent}
                onToggle={() => onToggle(ln.path)}
                onCopy={onCopy} copiedIdx={copiedIdx}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Toolbar button style ─────────────────────────────────────────────────────
const TBTN = {
  fontSize: 11, padding: '3px 8px',
  borderRadius: 'var(--border-radius-md, 4px)',
  border: '0.5px solid var(--color-border-secondary, #ccc)',
  background: 'transparent', color: 'var(--color-text-secondary, #666)',
  cursor: 'pointer', display: 'flex', alignItems: 'center',
  gap: 4, whiteSpace: 'nowrap', fontFamily: 'inherit',
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function PostmanJsonViewer({ value, className = '' }) {
  const { theme } = useUIStore();
  const isDark    = theme === 'dark';
  const colors    = isDark ? DARK : LIGHT;

  const activeRaw = value ?? '';
  const isHuge    = activeRaw.length > HUGE;

  // ── Paste mode lets user drop in arbitrary JSON ─────────────────────────────
  const [pasteText, setPasteText] = useState('');
  const [pasteOverride, setPasteOverride] = useState(''); // set after "parse ↗"

  // ── For huge files: user can opt into Pretty after acknowledging the cost ───
  const [forceParseHuge, setForceParseHuge] = useState(false);

  // Single source of truth for what the worker parses
  const displayRaw  = pasteOverride || activeRaw;
  const shouldParse = !!pasteOverride || !isHuge || forceParseHuge;
  const workerRaw   = shouldParse ? displayRaw : '';

  // ── ONE worker call — no duplicate instances ────────────────────────────────
  const { status, parsed, error, parseMs } = useJsonWorker(workerRaw);

  // ── Tabs: 'pretty' | 'raw' | 'paste' ───────────────────────────────────────
  const [tab, setTab] = useState(isHuge ? 'raw' : 'pretty');

  // ── Expand/collapse: empty Set = everything collapsed (fast initial render) ─
  const [expandedPaths, setExpanded] = useState(new Set());

  // ── Copy feedback ───────────────────────────────────────────────────────────
  const [copiedIdx, setCopiedIdx] = useState(null);

  // ── Search ──────────────────────────────────────────────────────────────────
  const [searchRaw, setSearchRaw] = useState('');  // controlled input (immediate)
  const [searchQ,   setSearchQ]   = useState('');  // debounced value used for matching
  const [searchIdx, setSearchIdx] = useState(0);
  const debounceRef    = useRef(null);
  const searchInputRef = useRef(null);
  const hitScrollRef   = useRef(null); // points at the virtual list container

  const handleSearchInput = useCallback(e => {
    const v = e.target.value;
    setSearchRaw(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQ(v);
      setSearchIdx(0);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  // ── Reset all state when parent passes a new response ──────────────────────
  useEffect(() => {
    setPasteOverride('');
    setPasteText('');
    setForceParseHuge(false);
    setExpanded(new Set());
    setTab(activeRaw.length > HUGE ? 'raw' : 'pretty');
    setSearchRaw('');
    setSearchQ('');
    setSearchIdx(0);
    setCopiedIdx(null);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-expand all nodes when parse completes ─────────────────────────────
  // Runs once per parsed object — gives Postman-style "everything open on load".
  // collectAllExpandable is a cheap DFS that only runs on parse completion.
  useEffect(() => {
    if (parsed) {
      setExpanded(collectAllExpandable(parsed, 'root'));
    }
  }, [parsed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Line building — cheap because only expanded subtrees are walked ────────
  const lines = useMemo(() => {
    if (!parsed) return [];
    return buildLines(parsed, 'root', 0, expandedPaths, false);
  }, [parsed, expandedPaths]);

  // ── Search hits ────────────────────────────────────────────────────────────
  // We scan `lines` only. Since `expandedPaths` now auto-expands to reveal all hits,
  // all hits WILL be present in `lines`.
  const { hitSet, hitIndices } = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q || !lines.length) return { hitSet: new Set(), hitIndices: [] };
    const indices = [];
    const s       = new Set();
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].raw.toLowerCase().includes(q)) { s.add(i); indices.push(i); }
    }
    return { hitSet: s, hitIndices: indices };
  }, [searchQ, lines]);

  const clampedIdx = hitIndices.length ? Math.min(searchIdx, hitIndices.length - 1) : 0;

  // ── Auto-expand nodes that match the search query ──────────────────────────
  useEffect(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q || !parsed) return;

    // Fast DFS to find paths of all nodes matching the query
    const newExpanded = new Set(expandedPaths);
    let added = false;

    function searchNode(v, path) {
      let isMatch = false;

      // Check this node
      if (v === null) {
        if ("null".includes(q)) isMatch = true;
      } else if (typeof v === 'boolean' || typeof v === 'number') {
        if (String(v).toLowerCase().includes(q)) isMatch = true;
      } else if (typeof v === 'string') {
        if (v.toLowerCase().includes(q)) isMatch = true;
      } else if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
          if (searchNode(v[i], `${path}[${i}]`)) {
            newExpanded.add(path); // expand array
            added = true;
            isMatch = true;
          }
        }
      } else if (typeof v === 'object') {
        const keys = Object.keys(v);
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          const kMatch = k.toLowerCase().includes(q);
          const childMatch = searchNode(v[k], `${path}.${k}`);
          
          if (kMatch || childMatch) {
            newExpanded.add(path); // expand object
            added = true;
            isMatch = true;
          }
        }
      }
      return isMatch;
    }

    searchNode(parsed, 'root');

    // Only update state if we actually needed to expand something new
    if (added) {
      setExpanded(newExpanded);
    }
  }, [searchQ, parsed]); // deliberately omitted expandedPaths to avoid infinite loop

  // Auto-scroll to current search hit
  useLayoutEffect(() => {
    if (!hitIndices.length) return;
    const hitRowIdx = hitIndices[clampedIdx];
    const el = hitScrollRef.current;
    if (el) el.scrollTop = Math.max(0, (hitRowIdx - 5) * ROW_H);
  }, [clampedIdx, hitIndices, lines]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleToggle = useCallback(path => {
    setExpanded(prev => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });
  }, []);

  const handleExpandAll   = useCallback(() => { if (parsed) setExpanded(collectAllExpandable(parsed, 'root')); }, [parsed]);
  const handleCollapseAll = useCallback(() => setExpanded(new Set()), []);

  const handleCopy = useCallback((text, idx) => {
    copyText(text).then(() => { setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 1200); });
  }, []);

  const handleCopyAll = useCallback(() => {
    copyText(displayRaw).then(() => { setCopiedIdx(-1); setTimeout(() => setCopiedIdx(null), 1200); });
  }, [displayRaw]);

  const navigateSearch = useCallback(delta => {
    setSearchIdx(prev => hitIndices.length ? ((prev + delta) + hitIndices.length) % hitIndices.length : 0);
  }, [hitIndices.length]);

  const handleParsePaste = () => {
    if (!pasteText.trim()) return;
    setPasteOverride(pasteText);
    // expandedPaths will be set by the auto-expand effect once the worker returns
    setExpanded(new Set());
    setSearchRaw(''); setSearchQ(''); setSearchIdx(0);
    setTab('pretty');
  };

  const sizeLabel = displayRaw ? formatSize(new Blob([displayRaw]).size) : '';

  // ── Empty ────────────────────────────────────────────────────────────────────
  if (!activeRaw && !pasteOverride) {
    return (
      <div className={className} style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary, #aaa)', fontSize: 13 }}>
        No response body
      </div>
    );
  }

  // ── Parsing spinner ───────────────────────────────────────────────────────────
  if (status === 'parsing' && tab === 'pretty') {
    return (
      <div className={className} style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--color-text-tertiary, #aaa)' }}>
        <div style={{ position: 'relative', width: 30, height: 30 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--color-border-secondary, #e0e0e0)' }}/>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid transparent', borderTopColor: isDark ? '#85B7EB' : '#185FA5', animation: 'pjv-spin 0.7s linear infinite' }}/>
        </div>
        <span style={{ fontSize: 12 }}>Parsing JSON…</span>
        <style>{`@keyframes pjv-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Parse error ───────────────────────────────────────────────────────────────
  if (status === 'error' && tab === 'pretty' && !isHuge) {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '0.5px solid var(--color-border-tertiary, #e0e0e0)', background: 'var(--color-background-secondary, #f9f9f9)', flexShrink: 0 }}>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#FCEBEB', color: '#A32D2D' }}>parse error</span>
          <button onClick={handleCopyAll} style={TBTN}>⎘ copy raw</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, flex: 1, color: '#A32D2D', fontSize: 13 }}>
          <div style={{ fontSize: 22 }}>⚠</div>
          <div>{error}</div>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--color-text-secondary)', maxWidth: '80%', wordBreak: 'break-all', textAlign: 'center' }}>
            {activeRaw.slice(0, 300)}{activeRaw.length > 300 ? '…' : ''}
          </div>
        </div>
      </div>
    );
  }

  // ─── Normal render ────────────────────────────────────────────────────────────
  return (
    <div
      className={className}
      style={{
        display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
        background: 'var(--color-background-primary)',
        border: 'none',
        borderRadius: 'var(--border-radius-lg, 6px)',
      }}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid var(--border-1, #333)',
        background: 'var(--color-background-secondary)', flexShrink: 0, gap: 8, flexWrap: 'wrap',
      }}>
        {/* Left: status badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {isHuge && !forceParseHuge && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#FFF3CD', color: '#856404', fontWeight: 600 }}>
              ⚠ Large file
            </span>
          )}
          {status === 'done' && !isHuge && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#EAF3DE', color: '#3B6D11' }}>
              valid JSON
            </span>
          )}
          {sizeLabel && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--color-background-tertiary)', color: 'var(--color-text-secondary)' }}>
              {sizeLabel}
            </span>
          )}
          {status === 'done' && tab === 'pretty' && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--color-background-tertiary)', color: 'var(--color-text-secondary)' }}>
              {lines.length.toLocaleString()} lines
            </span>
          )}
          {parseMs > 0 && status === 'done' && (
            <span title={window.__TAURI__ ? 'Parsed via Rust serde_json' : 'Parsed via Web Worker'} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--color-background-tertiary)', color: 'var(--color-text-secondary)' }}>
              ⚡ {Math.round(parseMs) || '<1'}ms
            </span>
          )}
        </div>

        {/* Right: controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* Search box — only in pretty mode with valid data */}
          {tab === 'pretty' && status === 'done' && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 7, color: 'var(--color-text-tertiary)', pointerEvents: 'none', fontSize: 12 }}>⌕</span>
              <input
                ref={searchInputRef}
                value={searchRaw}
                onChange={handleSearchInput}
                onKeyDown={e => {
                  if (e.key === 'Enter') navigateSearch(e.shiftKey ? -1 : 1);
                  if (e.key === 'Escape') { setSearchRaw(''); setSearchQ(''); }
                }}
                placeholder="search keys/values…"
                style={{
                  fontSize: 11, padding: '3px 80px 3px 24px', borderRadius: 4,
                  border: '0.5px solid var(--color-border-secondary, #ccc)',
                  background: 'var(--color-background-primary)',
                  color: 'var(--color-text-primary)', fontFamily: 'inherit',
                  width: 220, outline: 'none',
                }}
              />
              {searchRaw && (
                <>
                  <span style={{ position: 'absolute', right: 46, fontSize: 10, color: 'var(--color-text-tertiary)', pointerEvents: 'none', background: 'var(--color-background-primary)', paddingLeft: 4 }}>
                    {hitIndices.length ? `${clampedIdx + 1}/${hitIndices.length}` : '0/0'}
                  </span>
                  <button onClick={() => navigateSearch(-1)} style={{ position: 'absolute', right: 22, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', fontSize: 12, padding: '0 2px' }} title="Previous (Shift+Enter)">‹</button>
                  <button onClick={() => navigateSearch(1)}  style={{ position: 'absolute', right: 6,  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', fontSize: 12, padding: '0 2px' }} title="Next (Enter)">›</button>
                </>
              )}
            </div>
          )}

          {tab === 'pretty' && status === 'done' && (
            <>
              <button style={TBTN} onClick={handleExpandAll}>↕ expand all</button>
              <button style={TBTN} onClick={handleCollapseAll}>↔ collapse</button>
            </>
          )}

          {/* Pretty ↔ Raw toggle */}
          <button
            style={TBTN}
            onClick={() => {
              if (tab === 'pretty') {
                setTab('raw');
              } else {
                setTab('pretty');
                // Huge file: trigger parse when user opts into Pretty
                if (isHuge && !forceParseHuge && !pasteOverride) setForceParseHuge(true);
              }
            }}
          >
            ⊞ {tab === 'pretty' ? 'raw' : 'pretty'}
          </button>

          <button style={TBTN} onClick={handleCopyAll}>
            {copiedIdx === -1 ? '✓ copied' : '⎘ copy'}
          </button>
        </div>
      </div>

      {/* ── Tab strip ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border-1, #333)',
        background: 'var(--color-background-secondary)', flexShrink: 0,
      }}>
        {['pretty', 'raw', 'paste'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              fontSize: 11, padding: '5px 14px', cursor: 'pointer',
              color: tab === t ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid currentColor' : '2px solid transparent',
              fontFamily: 'inherit',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* ── Pretty ──────────────────────────────────────────────────────────── */}
        {tab === 'pretty' && (
          status !== 'done' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-secondary)', fontSize: 13 }}>
              {status === 'parsing' ? 'Parsing…' : 'No data'}
            </div>
          ) : lines.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-secondary)', fontSize: 13 }}>
              empty JSON
            </div>
          ) : (
            // Pass hitScrollRef so search hits can scroll the container
            <div style={{ height: '100%' }}>
              <VirtualJsonList
                lines={lines} colors={colors}
                hitSet={hitSet} hitIndices={hitIndices} searchIdx={clampedIdx}
                onToggle={handleToggle} onCopy={handleCopy} copiedIdx={copiedIdx}
                scrollRef={hitScrollRef}
              />
            </div>
          )
        )}

        {/* ── Raw ─────────────────────────────────────────────────────────────── */}
        {tab === 'raw' && (
          <div style={{
            height: '100%', overflow: 'auto', padding: 12,
            fontSize: 11.5, lineHeight: 1.6,
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono, monospace)',
          }}>
            {displayRaw}
          </div>
        )}

        {/* ── Paste ───────────────────────────────────────────────────────────── */}
        {tab === 'paste' && (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              Paste JSON below and press parse
            </div>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder='{"key": "value"}'
              style={{
                width: '100%', height: 120, resize: 'vertical', fontSize: 11,
                fontFamily: 'var(--font-mono, monospace)',
                border: '0.5px solid var(--color-border-secondary, #ccc)',
                borderRadius: 4, padding: 8,
                background: 'var(--color-background-primary)',
                color: 'var(--color-text-primary)', outline: 'none',
              }}
            />
            <button onClick={handleParsePaste} style={{ ...TBTN, width: 'fit-content' }}>
              parse ↗
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
