import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Braces, AlignLeft, Copy, Check, FileJson, FileCode, FileText, Code, Search } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Syntax Highlighter ────────────────────────────────────────────────────────
function highlight(code) {
  if (!code) return '';
  return code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"((?:[^"\\]|\\.)*)"\s*:/g, '<span class="jk">"$1"</span>:')
    .replace(/:\s*"((?:[^"\\]|\\.)*)"/g, ': <span class="js">"$1"</span>')
    .replace(/:\s*(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g, ': <span class="jn">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span class="jb">$1</span>')
    .replace(/:\s*(null)/g, ': <span class="jnu">$1</span>')
    .replace(/([{}\[\]])/g, '<span class="jbk">$1</span>');
}

// ── Autocomplete Data ─────────────────────────────────────────────────────────
const REST_KEYS = [
  'id','_id','uuid','name','firstName','lastName','email','phone','username',
  'password','token','accessToken','refreshToken','apiKey','role','permissions',
  'status','isActive','isDeleted','enabled','type','category','tags',
  'createdAt','updatedAt','deletedAt','timestamp','page','limit','offset','total',
  'data','meta','message','error','code','success','result','results','items','count',
  'address','city','country','zipCode','price','amount','quantity','rating','score',
  'url','imageUrl','thumbnail','description','title','slug','content',
  'userId','projectId','parentId','avatar','weight',
];

const VALUE_SNIPPETS = [
  { label: 'true',  insert: 'true' },
  { label: 'false', insert: 'false' },
  { label: 'null',  insert: 'null' },
  { label: '[]',    insert: '[]' },
  { label: '{}',    insert: '{}' },
];

function extractKeys(str) {
  try {
    const keys = new Set();
    const walk = (o, d = 0) => {
      if (d > 5 || !o || typeof o !== 'object') return;
      Object.keys(o).forEach(k => { keys.add(k); walk(o[k], d + 1); });
    };
    walk(JSON.parse(str));
    return [...keys];
  } catch { return []; }
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function JsonEditor({ value, onChange, language = 'json', readOnly = false, className = '', hideHeader = false }) {
  const taRef = useRef(null);
  const preRef = useRef(null);
  const acRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [ac, setAc] = useState({ open: false, items: [], idx: 0, top: 0, left: 0, mode: 'key' });

  // Sync scroll between textarea and highlight layer
  const syncScroll = () => {
    if (preRef.current && taRef.current) {
      preRef.current.scrollTop = taRef.current.scrollTop;
      preRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };

  const highlighted = useMemo(() => highlight(value || '') + '\n', [value]);

  // ── Autocomplete Logic ──────────────────────────────────────────────────────
  const computeAc = useCallback((val, cursorPos, ta) => {
    const before = val.slice(0, cursorPos);
    const lineStart = before.lastIndexOf('\n') + 1;
    const lineUpTo = before.slice(lineStart);

    const isKey = /^\s*"?(\w*)$/.test(lineUpTo) || /,\s*"?(\w*)$/.test(lineUpTo);
    const isVal = /:\s*"?(\w*)$/.test(lineUpTo);

    const currentWord = (lineUpTo.match(/"?(\w+)$/) || [])[1] || '';
    const docKeys = extractKeys(val);
    const allKeys = [...new Set([...docKeys.map(k => ({ label: k, insert: `"${k}": `, doc: '↑ this doc' })), ...REST_KEYS.filter(k => !docKeys.includes(k)).map(k => ({ label: k, insert: `"${k}": `, doc: 'REST API' }))])];

    let items = [];
    if (isVal) {
      items = VALUE_SNIPPETS.filter(i => i.label.startsWith(currentWord));
    } else if (isKey) {
      items = allKeys.filter(i => i.label.toLowerCase().startsWith(currentWord.toLowerCase())).slice(0, 12);
    }

    if (!items.length) { setAc(a => ({ ...a, open: false })); return; }

    // Get caret pixel position
    const { offsetTop, offsetLeft } = getCaretCoords(ta, cursorPos);
    const rect = ta.getBoundingClientRect();
    const parentRect = ta.closest('.editor-wrap')?.getBoundingClientRect() || rect;

    setAc({ open: true, items, idx: 0, top: offsetTop - ta.scrollTop + 22, left: Math.max(4, offsetLeft - ta.scrollLeft), mode: isVal ? 'val' : 'key' });
  }, []);

  const applyAc = useCallback((item) => {
    const ta = taRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const val = ta.value;
    const before = val.slice(0, pos);
    const wordMatch = before.match(/"?(\w*)$/);
    const wordLen = wordMatch ? wordMatch[0].length : 0;
    const insert = typeof item === 'string' ? item : (item.insert || item.label);
    const newVal = val.slice(0, pos - wordLen) + insert + val.slice(pos);
    onChange(newVal);
    const newCursor = pos - wordLen + insert.length;
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = newCursor; ta.focus(); }, 0);
    setAc(a => ({ ...a, open: false }));
  }, [onChange]);

  // ── Key Handling ────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    const ta = e.target;

    // Autocomplete navigation
    if (ac.open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAc(a => ({ ...a, idx: (a.idx + 1) % a.items.length })); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setAc(a => ({ ...a, idx: (a.idx - 1 + a.items.length) % a.items.length })); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyAc(ac.items[ac.idx]); return; }
      if (e.key === 'Escape') { setAc(a => ({ ...a, open: false })); return; }
    }

    // Tab → 2-space indent
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart, end = ta.selectionEnd;
      const v = ta.value;
      const newVal = v.slice(0, s) + '  ' + v.slice(end);
      onChange(newVal);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + 2; }, 0);
      return;
    }

    // Auto-close brackets & quotes
    const pairs = { '{': '}', '[': ']', '"': '"' };
    if (pairs[e.key] && !readOnly) {
      e.preventDefault();
      const s = ta.selectionStart, end = ta.selectionEnd;
      const v = ta.value;
      const close = pairs[e.key];
      const newVal = v.slice(0, s) + e.key + v.slice(s, end) + close + v.slice(end);
      onChange(newVal);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + 1; }, 0);
      return;
    }

    // Enter → smart indent
    if (e.key === 'Enter' && !readOnly) {
      const s = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
      const lineContent = ta.value.slice(lineStart, s);
      const indent = lineContent.match(/^(\s*)/)[1];
      const prevChar = ta.value[s - 1];
      const nextChar = ta.value[s];
      const extraIndent = ['{', '['].includes(prevChar) ? '  ' : '';
      e.preventDefault();
      const newLine = '\n' + indent + extraIndent;
      const closing = extraIndent && ['}', ']'].includes(nextChar) ? '\n' + indent : '';
      const v = ta.value;
      const newVal = v.slice(0, s) + newLine + closing + v.slice(s);
      onChange(newVal);
      const newPos = s + newLine.length;
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = newPos; }, 0);
    }
  }, [ac, applyAc, onChange, readOnly]);

  const handleInput = useCallback((e) => {
    const ta = e.target;
    onChange(ta.value);
    syncScroll();
    computeAc(ta.value, ta.selectionStart, ta);
  }, [onChange, computeAc]);

  // ── Toolbar actions ─────────────────────────────────────────────────────────
  const handleFormat = useCallback(() => {
    try { onChange(JSON.stringify(JSON.parse(value || ''), null, 2)); toast.success('JSON Formatted'); }
    catch { toast.error('Invalid JSON'); }
  }, [value, onChange]);

  const handleMinify = useCallback(() => {
    try { onChange(JSON.stringify(JSON.parse(value || ''))); toast.success('JSON Minified'); }
    catch { toast.error('Invalid JSON'); }
  }, [value, onChange]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value || '');
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success('Copied');
  }, [value]);

  // ── Validation ──────────────────────────────────────────────────────────────
  const validStatus = useMemo(() => {
    if (!value?.trim()) return null;
    try { JSON.parse(value); return true; } catch { return false; }
  }, [value]);

  const lineCount = useMemo(() => (value || '').split('\n').length, [value]);

  const getLangIcon = () => {
    if (language === 'json') return <FileJson size={14} style={{ color: '#F7DF1E' }} />;
    if (language === 'xml')  return <FileCode size={14} style={{ color: '#FF5733' }} />;
    if (language === 'html') return <Code size={14} style={{ color: '#E34F26' }} />;
    return <FileText size={14} style={{ color: '#888' }} />;
  };

  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`} style={{ background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-1)' }}>
      <style>{`
        .jk  { color: var(--text-primary) }
        .js  { color: var(--success) }
        .jn  { color: var(--info) }
        .jb  { color: var(--warning) }
        .jnu { color: var(--text-muted) }
        .jbk { color: var(--text-secondary) }
        .editor-ta {
          position: absolute; inset: 0; width: 100%; height: 100%;
          background: transparent; color: transparent; caret-color: var(--text-primary);
          border: none; outline: none; resize: none;
          font: 12px/1.7 'JetBrains Mono','Fira Code',monospace;
          padding: 12px 12px 12px 0; white-space: pre; overflow: auto;
          tab-size: 2; z-index: 2; -webkit-text-fill-color: transparent;
        }
        .editor-pre {
          position: absolute; inset: 0; margin: 0; overflow: hidden;
          font: 12px/1.7 'JetBrains Mono','Fira Code',monospace;
          padding: 12px 12px 12px 0; white-space: pre; word-break: break-all;
          pointer-events: none; z-index: 1;
        }
        .editor-wrap { position: relative; flex: 1; overflow: hidden; }
        .ln-col {
          width: 44px; min-width: 44px; padding: 12px 8px 12px 0;
          text-align: right; font: 11px/1.7 'JetBrains Mono',monospace;
          color: var(--text-muted); border-right: 0.5px solid var(--border-1);
          overflow: hidden; user-select: none; flex-shrink: 0;
        }
        .ac-drop {
          position: absolute; z-index: 100; min-width: 220px; max-width: 360px;
          background: var(--surface-1); border: 1px solid var(--border-1);
          border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          overflow: hidden; max-height: 220px; overflow-y: auto;
        }
        .ac-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 5px 10px; font: 11.5px/1 'JetBrains Mono',monospace;
          cursor: pointer; gap: 8px; color: var(--text-primary);
        }
        .ac-item:hover, .ac-item.active { background: var(--surface-3); }
        .ac-label { color: #C8CDD8; }
        .ac-doc   { color: rgba(255,255,255,0.2); font-size: 10px; white-space: nowrap; }
        .tb-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 8px;
          border-radius: 6px; border: none; background: transparent;
          color: rgba(255,255,255,0.35); font-size: 10px; font-weight: 700;
          letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer;
          transition: color 0.15s, background 0.15s;
        }
        .tb-btn:hover { color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.06); }
      `}</style>

      {/* Toolbar */}
      {!hideHeader && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.06)' }}>{getLangIcon()}</div>
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
              {language === 'json' ? 'JSON Editor' : language === 'xml' ? 'XML Editor' : language === 'html' ? 'HTML Editor' : 'Plain Text'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {!readOnly && language === 'json' && (
              <>
                <button className="tb-btn" onClick={handleFormat} title="Format JSON (Ctrl+Shift+F)"><Braces size={12} /> Format</button>
                <button className="tb-btn" onClick={handleMinify} title="Minify JSON"><AlignLeft size={12} /> Minify</button>
                <div style={{ width: 0.5, height: 14, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
              </>
            )}
            <button className="tb-btn" onClick={handleCopy} title="Copy all">
              {copied ? <Check size={12} style={{ color: '#4ade80' }} /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      )}

      {/* Editor Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Line numbers */}
        <div className="ln-col">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Code area */}
        <div className="editor-wrap" style={{ flex: 1 }} onClick={() => setAc(a => ({ ...a, open: false }))}>
          {/* Highlight layer */}
          <pre
            ref={preRef}
            className="editor-pre"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
          {/* Input layer */}
          <textarea
            ref={taRef}
            className="editor-ta"
            value={value || ''}
            readOnly={readOnly}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            onInput={handleInput}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            onClick={() => setAc(a => ({ ...a, open: false }))}
            placeholder={language === 'json' ? '{\n  "key": "value"\n}' : ''}
          />

          {/* Autocomplete dropdown */}
          {ac.open && ac.items.length > 0 && (
            <div
              ref={acRef}
              className="ac-drop"
              style={{ top: ac.top, left: ac.left }}
              onMouseDown={e => e.preventDefault()}
            >
              {ac.items.map((item, i) => (
                <div
                  key={i}
                  className={`ac-item ${i === ac.idx ? 'active' : ''}`}
                  onMouseEnter={() => setAc(a => ({ ...a, idx: i }))}
                  onMouseDown={() => applyAc(item)}
                >
                  <span className="ac-label">{item.label || item}</span>
                  {item.doc && <span className="ac-doc">{item.doc}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom status bar */}
      {language === 'json' && validStatus !== null && (
        <div style={{ padding: '3px 12px', borderTop: '0.5px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: validStatus ? '#4ade80' : '#f87171', boxShadow: validStatus ? '0 0 6px rgba(74,222,128,0.5)' : '0 0 6px rgba(248,113,113,0.5)' }} />
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: validStatus ? '#4ade80' : '#f87171' }}>
            {validStatus ? 'Valid JSON' : 'Syntax Error'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
            {lineCount} lines · {(value || '').length} chars
          </span>
        </div>
      )}
    </div>
  );
}

// Helper: get approximate pixel coords of caret in textarea
function getCaretCoords(ta, pos) {
  const div = document.createElement('div');
  const style = window.getComputedStyle(ta);
  ['fontFamily','fontSize','lineHeight','padding','border','boxSizing','whiteSpace','wordWrap','wordBreak'].forEach(p => { div.style[p] = style[p]; });
  div.style.position = 'absolute'; div.style.visibility = 'hidden';
  div.style.width = ta.offsetWidth + 'px';
  div.textContent = ta.value.slice(0, pos);
  const span = document.createElement('span'); span.textContent = ta.value[pos] || '.';
  div.appendChild(span);
  document.body.appendChild(div);
  const { offsetTop, offsetLeft } = span;
  document.body.removeChild(div);
  return { offsetTop, offsetLeft };
}
