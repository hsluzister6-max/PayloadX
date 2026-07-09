import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Braces, AlignLeft, Copy, Check, FileJson, FileCode, FileText, Code } from 'lucide-react';
import toast from 'react-hot-toast';
import { validateJsonc, tryParseJsoncValue } from '@/utils/jsonc';
import { toggleJsonLineComment } from '@/utils/jsonLineComment';

// ── Syntax Highlighter (JSONC: faded full-line //, /* */, trailing // outside strings) ──
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Tokenizes ONE raw (unescaped) JSON/JSONC code line into colored HTML.
 *
 * A single left-to-right character scan (not chained regex .replace calls) so:
 *  - Strings are consumed as one atomic token — a `{`/`}`/`[`/`]` INSIDE a string
 *    value (e.g. `{"key": "some {braced} text"}`) is never mis-colored as a
 *    structural bracket, since we never re-scan inside an already-consumed string.
 *  - No characters are ever inserted/removed — only <span> markup is added around
 *    existing text — so the highlight layer always stays 1:1 with the textarea
 *    and the caret never drifts from what's visually under it.
 */
function highlightJsonTokens(code) {
  if (!code) return '';
  const n = code.length;
  const isWs = (c) => c === ' ' || c === '\t';
  const isWordChar = (c) => c != null && /[A-Za-z0-9_]/.test(c);

  let out = '';
  let i = 0;
  let lastSignificant = ''; // last non-whitespace char emitted — used to detect `: "value"` vs bare/array strings

  while (i < n) {
    const c = code[i];

    // String literal — scan to the matching unescaped closing quote as one token.
    if (c === '"') {
      let j = i + 1;
      while (j < n) {
        if (code[j] === '\\') { j += 2; continue; }
        if (code[j] === '"') { j += 1; break; }
        j += 1;
      }
      const strRaw = code.slice(i, j);
      let k = j;
      while (k < n && isWs(code[k])) k += 1;
      const isKey = code[k] === ':';
      const isValue = lastSignificant === ':';

      if (isKey) out += `<span class="jk">${escapeHtml(strRaw)}</span>`;
      else if (isValue) out += `<span class="js">${escapeHtml(strRaw)}</span>`;
      else out += escapeHtml(strRaw);

      i = j;
      lastSignificant = '"';
      continue;
    }

    // Structural brackets — reached here, so guaranteed to be outside any string.
    if (c === '{' || c === '}' || c === '[' || c === ']') {
      out += `<span class="jbk">${c}</span>`;
      i += 1;
      lastSignificant = c;
      continue;
    }

    if (!isWs(c)) {
      // Number
      if (c === '-' || (c >= '0' && c <= '9')) {
        const m = /^-?\d+\.?\d*(?:[eE][+-]?\d+)?/.exec(code.slice(i));
        if (m && m[0]) {
          out += `<span class="jn">${escapeHtml(m[0])}</span>`;
          i += m[0].length;
          lastSignificant = m[0].slice(-1);
          continue;
        }
      }
      // true / false / null — word-boundary checked so identifiers like `trueValue` aren't matched.
      if (code.startsWith('true', i) && !isWordChar(code[i + 4])) {
        out += '<span class="jb">true</span>';
        i += 4; lastSignificant = 'e'; continue;
      }
      if (code.startsWith('false', i) && !isWordChar(code[i + 5])) {
        out += '<span class="jb">false</span>';
        i += 5; lastSignificant = 'e'; continue;
      }
      if (code.startsWith('null', i) && !isWordChar(code[i + 4])) {
        out += '<span class="jnu">null</span>';
        i += 4; lastSignificant = 'l'; continue;
      }
    }

    out += escapeHtml(c);
    if (!isWs(c)) lastSignificant = c;
    i += 1;
  }

  return out;
}

/** `//` comment start outside double-quoted strings */
function splitTrailingLineComment(rawLine) {
  let inStr = false;
  let esc = false;
  for (let i = 0; i < rawLine.length - 1; i++) {
    const c = rawLine[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (inStr) {
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === '"') {
        inStr = false;
        continue;
      }
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === '/' && rawLine[i + 1] === '/') {
      return { code: rawLine.slice(0, i), comment: rawLine.slice(i) };
    }
  }
  return { code: rawLine, comment: '' };
}

function highlightJsonc(raw) {
  if (!raw) return '';
  const lines = raw.split('\n');
  let inBlock = false;
  const parts = [];
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const nl = li < lines.length - 1 ? '\n' : '';

    if (inBlock) {
      parts.push(`<span class="jc-comment">${escapeHtml(line)}</span>${nl}`);
      if (line.includes('*/')) inBlock = false;
      continue;
    }

    const m = /^(\s*)(.*)$/.exec(line);
    const ws = m ? m[1] : '';
    const trimmed = m ? m[2] : line;

    if (trimmed.startsWith('//')) {
      parts.push(`<span class="jc-comment">${escapeHtml(line)}</span>${nl}`);
      continue;
    }

    if (trimmed.startsWith('/*')) {
      parts.push(`<span class="jc-comment">${escapeHtml(line)}</span>${nl}`);
      if (!trimmed.includes('*/')) inBlock = true;
      continue;
    }

    const { code, comment } = splitTrailingLineComment(line);
    // highlightJsonTokens takes RAW code and escapes each token itself —
    // it needs to see literal quotes/brackets to tokenize correctly.
    let html = highlightJsonTokens(code);
    if (comment) {
      html += `<span class="jc-comment">${escapeHtml(comment)}</span>`;
    }
    parts.push(html + nl);
  }
  return parts.join('');
}

function highlightPlain(code) {
  return escapeHtml(code || '');
}

function duplicateSelectedLines(text, selStart, selEnd) {
  const s0 = Math.min(selStart, selEnd);
  const s1 = Math.max(selStart, selEnd);
  const lines = text.split('\n');
  const sl = text.slice(0, s0).split('\n').length - 1;
  const el = text.slice(0, s1).split('\n').length - 1;

  let lineStart = 0;
  for (let i = 0; i < sl; i++) lineStart += lines[i].length + 1;

  let lineAfterEnd = lineStart;
  for (let i = sl; i <= el; i++) {
    lineAfterEnd += lines[i].length + (i < lines.length - 1 ? 1 : 0);
  }

  const selected = text.slice(lineStart, lineAfterEnd);
  let insert = selected;
  if (!insert.endsWith('\n')) {
    insert = `\n${insert}`;
  }
  const newText = text.slice(0, lineAfterEnd) + insert + text.slice(lineAfterEnd);
  const dupStart = lineAfterEnd;
  const dupEnd = lineAfterEnd + insert.length;
  return { text: newText, selStart: dupStart, selEnd: dupEnd };
}

function deleteSelectedLines(text, selStart, selEnd) {
  const s0 = Math.min(selStart, selEnd);
  const s1 = Math.max(selStart, selEnd);
  const lines = text.split('\n');
  const sl = text.slice(0, s0).split('\n').length - 1;
  const el = text.slice(0, s1).split('\n').length - 1;

  let lineStart = 0;
  for (let i = 0; i < sl; i++) lineStart += lines[i].length + 1;

  let lineAfterEnd = lineStart;
  for (let i = sl; i <= el; i++) {
    lineAfterEnd += lines[i].length + (i < lines.length - 1 ? 1 : 0);
  }

  const newText = text.slice(0, lineStart) + text.slice(lineAfterEnd);
  const pos = Math.min(lineStart, newText.length);
  return { text: newText, selStart: pos, selEnd: pos };
}

function indentSelectedLines(text, selStart, selEnd, spaces = '  ') {
  const s0 = Math.min(selStart, selEnd);
  const s1 = Math.max(selStart, selEnd);
  const lines = text.split('\n');
  const sl = text.slice(0, s0).split('\n').length - 1;
  const el = text.slice(0, s1).split('\n').length - 1;
  const newLines = lines.map((ln, i) => (i >= sl && i <= el ? spaces + ln : ln));
  const newText = newLines.join('\n');
  const n = spaces.length;
  return {
    text: newText,
    selStart: shiftPosAfterIndent(text, sl, el, s0, n),
    selEnd: shiftPosAfterIndent(text, sl, el, s1, n),
  };
}

/** After prepending `n` spaces to lines [sl..el], map global offset `pos`. */
function shiftPosAfterIndent(text, sl, el, pos, n) {
  const lines = text.split('\n');
  let o = 0;
  const posLine = text.slice(0, pos).split('\n').length - 1;
  let shift = 0;
  for (let i = 0; i < lines.length; i++) {
    const L = o;
    if (i >= sl && i <= el) {
      if (i < posLine) shift += n;
      else if (i === posLine && pos >= L) shift += n;
    }
    o += lines[i].length + (i < lines.length - 1 ? 1 : 0);
  }
  return pos + shift;
}

function outdentSelectedLines(text, selStart, selEnd) {
  const s0 = Math.min(selStart, selEnd);
  const s1 = Math.max(selStart, selEnd);
  const lines = text.split('\n');
  const sl = text.slice(0, s0).split('\n').length - 1;
  const el = text.slice(0, s1).split('\n').length - 1;

  const newLines = lines.map((ln, i) => {
    if (i < sl || i > el) return ln;
    if (ln.startsWith('  ')) return ln.slice(2);
    if (ln.startsWith('\t')) return ln.slice(1);
    return ln;
  });
  const newText = newLines.join('\n');

  return {
    text: newText,
    selStart: s0 - charsRemovedBeforePos(lines, sl, el, s0),
    selEnd: s1 - charsRemovedBeforePos(lines, sl, el, s1),
  };
}

/** Prefix stripped from lines [sl..el]: count how many deleted chars fell strictly before `pos`. */
function charsRemovedBeforePos(lines, sl, el, pos) {
  let removed = 0;
  let o = 0;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const L = o;
    if (i >= sl && i <= el) {
      const rm = ln.startsWith('  ') ? 2 : ln.startsWith('\t') ? 1 : 0;
      if (rm && pos > L) {
        removed += Math.min(rm, pos - L);
      }
    }
    o += ln.length + (i < lines.length - 1 ? 1 : 0);
  }
  return removed;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function JsonEditor({ value, onChange, language = 'json', readOnly = false, className = '', hideHeader = false }) {
  const taRef = useRef(null);
  const preRef = useRef(null);
  const lnRef = useRef(null);
  const pendingSelectionRef = useRef(null);
  const suppressInputRef = useRef(false);
  const isFocusedRef = useRef(false);
  const [localValue, setLocalValue] = useState(value ?? '');

  // Sync external value when editor is not focused (format, minify, tab switch)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(value ?? '');
    }
  }, [value]);

  const applyEdit = useCallback(({ text, selStart, selEnd }) => {
    pendingSelectionRef.current = { start: selStart, end: selEnd };
    suppressInputRef.current = true;
    setLocalValue(text);
    onChange(text);
  }, [onChange]);

  useLayoutEffect(() => {
    const ta = taRef.current;
    const pending = pendingSelectionRef.current;
    if (!ta || !pending) return;

    const len = ta.value.length;
    const start = Math.min(pending.start, len);
    const end = Math.min(pending.end, len);
    ta.selectionStart = start;
    ta.selectionEnd = end;
    pendingSelectionRef.current = null;

    // WebView2 (Windows) may reset selection after layout — restore once more next frame
    requestAnimationFrame(() => {
      if (document.activeElement !== ta) return;
      if (ta.selectionStart !== start || ta.selectionEnd !== end) {
        ta.selectionStart = start;
        ta.selectionEnd = end;
      }
    });
  }, [localValue]);

  const [copied, setCopied] = useState(false);
  const syncScroll = () => {
    const ta = taRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (lnRef.current) {
      lnRef.current.scrollTop = ta.scrollTop;
    }
  };

  const highlighted = useMemo(() => {
    const v = localValue || '';
    if (language === 'json') return highlightJsonc(v);
    return highlightPlain(v);
  }, [localValue, language]);

  // ── Key Handling (Postman-style: no auto-pair, no smart Enter, no autocomplete) ──
  const handleKeyDown = useCallback((e) => {
    const ta = e.target;
    const mod = e.ctrlKey || e.metaKey;

    // Block Insert key — prevents browser from toggling overwrite mode
    if (e.key === 'Insert') {
      e.preventDefault();
      return;
    }

    // JSON / JSONC: Cmd/Ctrl + / toggles line comments
    if (mod && e.key === '/') {
      e.preventDefault();
      if (!readOnly && language === 'json') {
        const { text, selStart, selEnd } = toggleJsonLineComment(ta.value, ta.selectionStart, ta.selectionEnd);
        applyEdit({ text, selStart, selEnd });
      }
      return;
    }

    // Duplicate line(s): Cmd/Ctrl+D
    if (mod && !e.shiftKey && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      if (!readOnly) {
        const r = duplicateSelectedLines(ta.value, ta.selectionStart, ta.selectionEnd);
        applyEdit({ text: r.text, selStart: r.selStart, selEnd: r.selEnd });
      }
      return;
    }

    // Delete line(s): Cmd/Ctrl+Shift+K
    if (mod && e.shiftKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (!readOnly) {
        const r = deleteSelectedLines(ta.value, ta.selectionStart, ta.selectionEnd);
        applyEdit({ text: r.text, selStart: r.selStart, selEnd: r.selEnd });
      }
      return;
    }

    // Tab / Shift+Tab — indent / outdent (Postman-style)
    if (e.key === 'Tab') {
      e.preventDefault();
      if (readOnly) return;
      const s = ta.selectionStart;
      const end = ta.selectionEnd;
      const v = ta.value;
      const lineS = v.slice(0, s).split('\n').length - 1;
      const lineE = v.slice(0, end).split('\n').length - 1;
      const multiLine = lineS !== lineE;

      if (multiLine) {
        const r = e.shiftKey
          ? outdentSelectedLines(v, s, end)
          : indentSelectedLines(v, s, end);
        applyEdit({ text: r.text, selStart: r.selStart, selEnd: r.selEnd });
        return;
      }

      if (e.shiftKey) {
        const r = outdentSelectedLines(v, s, end);
        applyEdit({ text: r.text, selStart: r.selStart, selEnd: r.selEnd });
        return;
      }

      applyEdit({ text: v.slice(0, s) + '  ' + v.slice(end), selStart: s + 2, selEnd: s + 2 });
    }
  }, [applyEdit, readOnly, language]);

  const handleChange = useCallback((e) => {
    const ta = e.target;
    if (suppressInputRef.current) {
      suppressInputRef.current = false;
      syncScroll();
      return;
    }
    pendingSelectionRef.current = {
      start: ta.selectionStart,
      end: ta.selectionEnd,
    };
    setLocalValue(ta.value);
    onChange(ta.value);
    syncScroll();
  }, [onChange]);

  const handleSelect = useCallback((e) => {
    pendingSelectionRef.current = {
      start: e.target.selectionStart,
      end: e.target.selectionEnd,
    };
  }, []);

  // ── Toolbar actions ─────────────────────────────────────────────────────────
  const handleFormat = useCallback(() => {
    const raw = localValue || '';
    if (!raw.trim()) return;
    const v = tryParseJsoncValue(raw);
    if (v === undefined) {
      toast.error('Invalid JSON');
      return;
    }
    const formatted = JSON.stringify(v, null, 2);
    applyEdit({ text: formatted, selStart: 0, selEnd: 0 });
    toast.success('JSON formatted');
  }, [localValue, applyEdit]);

  const handleMinify = useCallback(() => {
    const raw = localValue || '';
    if (!raw.trim()) return;
    const v = tryParseJsoncValue(raw);
    if (v === undefined) {
      toast.error('Invalid JSON');
      return;
    }
    const minified = JSON.stringify(v);
    applyEdit({ text: minified, selStart: 0, selEnd: 0 });
    toast.success('JSON minified');
  }, [localValue, applyEdit]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(localValue || '');
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success('Copied');
  }, [localValue]);

  // ── Validation ──────────────────────────────────────────────────────────────
  const validStatus = useMemo(() => {
    if (!localValue?.trim()) return null;
    const { ok } = validateJsonc(localValue);
    return ok;
  }, [localValue]);

  const lineCount = useMemo(() => (localValue || '').split('\n').length, [localValue]);

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
        .jc-comment { opacity: 0.46; color: var(--text-muted) !important; font-style: italic; }
        .jc-comment .jk, .jc-comment .js, .jc-comment .jn, .jc-comment .jb, .jc-comment .jnu, .jc-comment .jbk { color: inherit !important; opacity: 1; }
        .editor-ta {
          position: absolute; inset: 0; width: 100%; height: 100%;
          background: transparent; color: transparent; caret-color: var(--text-primary);
          border: none; outline: none; resize: none;
          font: 12px/1.7 'JetBrains Mono','Fira Code',monospace;
          padding: 12px 12px 12px 0; white-space: pre; overflow: auto;
          tab-size: 2; z-index: 2; -webkit-text-fill-color: transparent;
          word-break: normal; overflow-wrap: normal;
          direction: ltr; unicode-bidi: plaintext;
          letter-spacing: normal; font-variant-ligatures: none;
        }
        .editor-pre {
          position: absolute; inset: 0; margin: 0; overflow: hidden;
          font: 12px/1.7 'JetBrains Mono','Fira Code',monospace;
          padding: 12px 12px 12px 0; white-space: pre;
          word-break: normal; overflow-wrap: normal;
          direction: ltr; unicode-bidi: plaintext;
          pointer-events: none; z-index: 1;
          letter-spacing: normal; font-variant-ligatures: none;
        }
        .editor-wrap { position: relative; flex: 1; overflow: hidden; }
        .ln-col {
          width: 44px; min-width: 44px; padding: 12px 8px 12px 0;
          text-align: right; font: 11px/1.7 'JetBrains Mono',monospace;
          color: var(--text-muted); border-right: 0.5px solid var(--border-1);
          overflow: hidden; user-select: none; flex-shrink: 0;
          height: 100%; box-sizing: border-box;
        }
        .tb-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 8px;
          border-radius: 6px; border: none; background: transparent;
          color: var(--text-muted); font-size: 10px; font-weight: 700;
          letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer;
          transition: color 0.15s, background 0.15s;
        }
        .tb-btn:hover { color: var(--text-primary); background: var(--surface-3); }
      `}</style>

      {/* Toolbar */}
      {!hideHeader && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', borderBottom: '1px solid var(--border-1)', background: 'var(--surface-2)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ padding: '4px 6px', borderRadius: 6, background: 'var(--surface-3)' }}>{getLangIcon()}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1.15 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--accent)' }}>
                PayloadX
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                {language === 'json' ? 'JSON (JSONC)' : language === 'xml' ? 'XML' : language === 'html' ? 'HTML' : 'Plain text'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {!readOnly && language === 'json' && (
              <>
                <button className="tb-btn" onClick={handleFormat} title="Format JSON (strips comments). ⌘/ Ctrl+/ toggle line comment · ⌘D duplicate line · ⇧⌘K delete line · Tab / ⇧Tab indent"><Braces size={12} /> Format</button>
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
        <div ref={lnRef} className="ln-col">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Code area */}
        <div className="editor-wrap" style={{ flex: 1 }}>
          {/* Highlight layer */}
          <pre
            ref={preRef}
            className="editor-pre"
            aria-hidden="true"
            dir="ltr"
            dangerouslySetInnerHTML={{
              // Trailing newline keeps highlight layer height in sync with textarea
              __html: highlighted + ((localValue || '').endsWith('\n') ? '\n' : '') || ' ',
            }}
          />
          {/* Input layer */}
          <textarea
            ref={taRef}
            className="editor-ta"
            value={localValue}
            readOnly={readOnly}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            dir="ltr"
            inputMode="text"
            onChange={handleChange}
            onSelect={handleSelect}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            onFocus={() => { isFocusedRef.current = true; }}
            onBlur={() => { isFocusedRef.current = false; }}
            placeholder={language === 'json' ? '{\n  "key": "value"  // JSONC\n}' : ''}
          />
        </div>
      </div>

      {/* Bottom status bar */}
      {language === 'json' && validStatus !== null && (
        <div style={{ padding: '3px 12px', borderTop: '1px solid var(--border-1)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: validStatus ? '#4ade80' : '#f87171', boxShadow: validStatus ? '0 0 6px rgba(74,222,128,0.5)' : '0 0 6px rgba(248,113,113,0.5)' }} />
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: validStatus ? '#4ade80' : '#f87171' }}>
            {validStatus ? 'Valid JSONC' : 'Syntax error'}
          </span>
          <span style={{ marginLeft: 12, fontSize: 8, color: 'rgba(255,255,255,0.22)', fontFamily: 'Inter, sans-serif', letterSpacing: '0.02em', maxWidth: 280, textAlign: 'right', lineHeight: 1.35 }}>
            Comments &amp; commented-out keys are dropped when sending (JSONC → JSON wire).
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
            {lineCount} lines · {(localValue || '').length} chars
          </span>
        </div>
      )}
    </div>
  );
}
