import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * PayloadX High-Performance JSON Viewer
 * 
 * - Handles standard JSON + NDJSON (newline-delimited JSON)
 * - Virtualized rendering for huge payloads (800+ lines)
 * - Instant search with hit navigation (Enter/Shift+Enter)
 * - Expand/collapse all with path-based collapse tracking
 * - Per-row copy buttons
 * - Metallic PayloadX dark theme with vibrant syntax colors
 */

const ROW_H = 22;
const OVERSCAN = 10;
const VTHRESH = 600; // lines before switching to virtual scroll
const INDENT_PX = 14;

// ── Syntax colors (dark theme aligned with PayloadX metals) ──────────────────
const T = {
  key: '#C8CDD8',   // platinum
  str: '#86EFAC',   // emerald
  num: '#93C5FD',   // azure
  bool: '#FDE047',   // gold
  null: '#94A3B8',   // slate
  bkt: 'rgba(255,255,255,0.4)', // bracket
  pun: 'rgba(255,255,255,0.2)', // punctuation / comma
  dim: 'rgba(255,255,255,0.18)', // collapsed preview
};

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/\n/g, '\\n').replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function formatSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

// ── Build flattened line array (recursive) ────────────────────────────────────
function buildLines(v, path, depth, trail, collapsed) {
  if (v === null) return [{ depth, path, col: false, col2: false, raw: 'null' + (trail ? ',' : ''), parts: [{ t: 'null', s: 'null' }, ...(trail ? [{ t: 'pun', s: ',' }] : [])] }];
  if (v === true || v === false) return [{ depth, path, col: false, col2: false, raw: String(v) + (trail ? ',' : ''), parts: [{ t: 'bool', s: String(v) }, ...(trail ? [{ t: 'pun', s: ',' }] : [])] }];
  if (typeof v === 'number') return [{ depth, path, col: false, col2: false, raw: String(v) + (trail ? ',' : ''), parts: [{ t: 'num', s: String(v) }, ...(trail ? [{ t: 'pun', s: ',' }] : [])] }];
  if (typeof v === 'string') {
    const i = esc(v);
    const d = `"${i}"` + (trail ? ',' : '');
    return [{ depth, path, col: false, col2: false, raw: d, parts: [{ t: 'str', s: `"${i}"` }, ...(trail ? [{ t: 'pun', s: ',' }] : [])] }];
  }

  if (Array.isArray(v)) {
    const isc = collapsed.has(path);
    if (!v.length) return [{ depth, path, col: false, col2: false, raw: '[]' + (trail ? ',' : ''), parts: [{ t: 'bkt', s: '[]' }, ...(trail ? [{ t: 'pun', s: ',' }] : [])] }];
    if (isc) {
      const sum = `[…${v.length} item${v.length !== 1 ? 's' : ''}]` + (trail ? ',' : '');
      return [{ depth, path, col: true, col2: true, raw: sum, parts: [{ t: 'bkt', s: '[' }, { t: 'dim', s: `…${v.length} item${v.length !== 1 ? 's' : ''}` }, { t: 'bkt', s: ']' }, ...(trail ? [{ t: 'pun', s: ',' }] : [])] }];
    }
    const ls = [{ depth, path, col: true, col2: false, raw: '[', parts: [{ t: 'bkt', s: '[' }] }];
    v.forEach((item, i) => { ls.push(...buildLines(item, `${path}[${i}]`, depth + 1, i < v.length - 1, collapsed)); });
    ls.push({ depth, path, col: true, col2: false, raw: ']' + (trail ? ',' : ''), parts: [{ t: 'bkt', s: ']' }, ...(trail ? [{ t: 'pun', s: ',' }] : [])] });
    return ls;
  }

  if (typeof v === 'object') {
    const isc = collapsed.has(path);
    const keys = Object.keys(v);
    if (!keys.length) return [{ depth, path, col: false, col2: false, raw: '{}' + (trail ? ',' : ''), parts: [{ t: 'bkt', s: '{}' }, ...(trail ? [{ t: 'pun', s: ',' }] : [])] }];
    if (isc) {
      const prev = keys.slice(0, 3).join(', ') + (keys.length > 3 ? ', …' : '');
      const sum = `{${prev}}` + (trail ? ',' : '');
      return [{ depth, path, col: true, col2: true, raw: sum, parts: [{ t: 'bkt', s: '{' }, { t: 'dim', s: prev }, { t: 'bkt', s: '}' }, ...(trail ? [{ t: 'pun', s: ',' }] : [])] }];
    }
    const ls = [{ depth, path, col: true, col2: false, raw: '{', parts: [{ t: 'bkt', s: '{' }] }];
    keys.forEach((k, i) => {
      const kp = `${path}.${k}`, kl = `"${esc(k)}"`;
      const cl = buildLines(v[k], kp, depth + 1, i < keys.length - 1, collapsed);
      const f = cl[0];
      ls.push({ ...f, depth: depth + 1, path: kp, raw: `${kl}: ${f.raw}`, parts: [{ t: 'key', s: kl }, { t: 'pun', s: ': ' }, ...f.parts] });
      for (let j = 1; j < cl.length; j++) ls.push(cl[j]);
    });
    ls.push({ depth, path, col: true, col2: false, raw: '}' + (trail ? ',' : ''), parts: [{ t: 'bkt', s: '}' }, ...(trail ? [{ t: 'pun', s: ',' }] : [])] });
    return ls;
  }
  return [];
}

function collectPaths(v, path, out = new Set()) {
  if (v === null || typeof v !== 'object') return out;
  if (Array.isArray(v)) { if (v.length) { out.add(path); v.forEach((x, i) => collectPaths(x, `${path}[${i}]`, out)); } }
  else { const k = Object.keys(v); if (k.length) { out.add(path); k.forEach(key => collectPaths(v[key], `${path}.${key}`, out)); } }
  return out;
}

// ── Single Row Component ──────────────────────────────────────────────────────
function Row({ ln, lineNum, isHit, isCurrent, onToggle, style }) {
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

  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        height: ROW_H,
        fontSize: 11.5,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        cursor: 'default',
        userSelect: 'text',
        background: isCurrent
          ? 'rgba(251,191,36,0.18)'
          : isHit
            ? 'rgba(251,191,36,0.07)'
            : 'transparent',
        paddingRight: 4,
      }}
      className="json-row"
    >
      {/* Line number */}
      <div
        onClick={() => ln.col && onToggle(ln.path)}
        style={{
          width: 48, minWidth: 48, textAlign: 'right', paddingRight: 10,
          color: T.dim, borderRight: '0.5px solid rgba(255,255,255,0.06)',
          fontSize: 10.5, cursor: ln.col ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 2, height: '100%', flexShrink: 0, userSelect: 'none',
        }}
      >
        {ln.col && (
          <span style={{ width: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.25)' }}>
            {ln.col2 ? '›' : '⌄'}
          </span>
        )}
        <span>{lineNum + 1}</span>
      </div>

      {/* Content */}
      <div style={{ paddingLeft: 6 + ln.depth * INDENT_PX, flex: 1, whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: ROW_H + 'px' }}>
        {ln.parts.map((p, i) => (
          <span key={i} style={{ color: T[p.t] || T.dim }}>{p.s}</span>
        ))}
      </div>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        title="Copy line"
        className="json-copy-btn"
        style={{
          width: 26, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#4ade80' : 'rgba(255,255,255,0.2)',
          flexShrink: 0, fontSize: 12, transition: 'color 0.15s',
        }}
      >
        {copied ? '✓' : '⎘'}
      </button>
    </div>
  );
}

// ── Virtual Scroller ──────────────────────────────────────────────────────────
function VirtualScroller({ lines, searchHits, searchIdx, onToggle }) {
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
    <div ref={outerRef} style={{ height: '100%', overflow: 'auto', position: 'relative' }}>
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
              style={{ position: 'absolute', top: i * ROW_H, left: 0, right: 0 }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Flat Scroller (small payloads) ────────────────────────────────────────────
function FlatScroller({ lines, searchHits, searchIdx, onToggle }) {
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
    <div ref={ref} style={{ height: '100%', overflow: 'auto' }}>
      {lines.map((ln, i) => (
        <div key={i} data-row={i}>
          <Row
            ln={ln}
            lineNum={i}
            isHit={hitSet.has(i)}
            isCurrent={i === curHit}
            onToggle={onToggle}
          />
        </div>
      ))}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function JsonTreeViewer({ value, className = '' }) {
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [rawStr, setRawStr] = useState('');
  const [collapsed, setCollapsed] = useState(new Set());
  const [tab, setTab] = useState('pretty'); // 'pretty' | 'raw'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState([]);
  const [searchIdx, setSearchIdx] = useState(0);
  const searchRef = useRef(null);

  // Parse whenever value changes
  useEffect(() => {
    if (!value) { setParsed(null); setParseError(null); setRawStr(''); return; }
    const cleaned = value.replace(/^\uFEFF/, '').trim();
    setRawStr(value);
    setCollapsed(new Set());
    setSearchQuery('');
    setSearchHits([]);
    setSearchIdx(0);

    let p = null, err = null;
    try {
      p = JSON.parse(cleaned);
    } catch (e) {
      // Try NDJSON (newline-delimited JSON)
      try {
        const nlines = cleaned.split('\n').filter(l => l.trim());
        if (nlines.length > 1) {
          p = nlines.map(l => JSON.parse(l));
        } else {
          err = e.message;
        }
      } catch (e2) {
        err = e2.message;
      }
    }
    setParsed(p);
    setParseError(err);
  }, [value]);

  // Build flat lines array
  const lines = useMemo(() => {
    if (!parsed) return [];
    return buildLines(parsed, 'root', 0, false, collapsed);
  }, [parsed, collapsed]);

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
    if (!parsed) return;
    setCollapsed(collectPaths(parsed, 'root'));
  }, [parsed]);

  const handleCopyAll = useCallback(() => {
    navigator.clipboard.writeText(rawStr).catch(() => { });
  }, [rawStr]);

  const handleSearchNav = useCallback((dir) => {
    if (!searchHits.length) return;
    setSearchIdx(i => (i + dir + searchHits.length) % searchHits.length);
  }, [searchHits]);

  const sizeLabel = useMemo(() => rawStr ? formatSize(new TextEncoder().encode(rawStr).length) : '', [rawStr]);
  const isNdjson = useMemo(() => Array.isArray(parsed) && rawStr?.includes('\n') && rawStr.trim().split('\n').length > 1, [parsed, rawStr]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!value) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`} style={{ color: 'rgba(255,255,255,0.15)', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
        No response body
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`} style={{ background: 'transparent', overflow: 'hidden' }}>
      {/* ── Minimal Floating Controls ─────────────────────────────────────── */}
      {parsed && (
        <div style={{
          position: 'absolute', top: 6, right: 14, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(7, 9, 13, 0.85)', backdropFilter: 'blur(4px)',
          padding: '4px', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.06)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          {/* Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: 6, color: 'rgba(255,255,255,0.25)', fontSize: 11, pointerEvents: 'none' }}>⌕</span>
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
                background: 'rgba(255,255,255,0.05)', color: '#D0D4DE',
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

          {/* Expand / Collapse icons */}
          <button onClick={handleExpandAll} style={{...iconBtnStyle(), background: 'transparent', border: 'none'}} title="Expand all">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
          <button onClick={handleCollapseAll} style={{...iconBtnStyle(), background: 'transparent', border: 'none'}} title="Collapse all">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
          </button>
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {parseError && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#F87171', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
            <span style={{ fontSize: 24 }}>⚠</span>
            <span style={{ opacity: 0.8, maxWidth: 360, textAlign: 'center', lineHeight: 1.5 }}>{parseError}</span>
            <button onClick={() => setTab('raw')} style={{ ...btnStyle(), marginTop: 4 }}>view raw</button>
          </div>
        )}

        {!parseError && tab === 'raw' && (
          <div style={{ height: '100%', overflow: 'auto', padding: 12, fontSize: 11.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#C8CDD8', fontFamily: "'JetBrains Mono', monospace" }}>
            {rawStr}
          </div>
        )}

        {!parseError && tab === 'pretty' && parsed && (
          <div style={{ height: '100%', overflow: 'hidden' }}>
            {/* Row hover style via <style> injection to avoid inline-on-each-row overhead */}
            <style>{`.json-row:hover{background:rgba(255,255,255,0.035)!important}.json-copy-btn:hover{color:rgba(255,255,255,0.6)!important}`}</style>
            {lines.length > VTHRESH ? (
              <VirtualScroller lines={lines} searchHits={searchHits} searchIdx={searchIdx} onToggle={handleToggle} />
            ) : (
              <FlatScroller lines={lines} searchHits={searchHits} searchIdx={searchIdx} onToggle={handleToggle} />
            )}
          </div>
        )}

        {!parseError && tab === 'pretty' && !parsed && value && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
            Parsing…
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
