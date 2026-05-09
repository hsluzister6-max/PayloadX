import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { FixedSizeList } from 'react-window';

const ROW_PX = 20;
const MAX_LINES_CAP = 350_000;
const SOFT_WRAP_CHUNK = 4096;

/**
 * Split body into display rows. Multi-line bodies use real newlines; a single huge line is hard-chunked
 * so virtualization still bounds DOM work (minified JSON case).
 */
export function splitForVirtualDisplay(text) {
  if (text == null || text === '') return [];
  const s = typeof text === 'string' ? text : String(text);
  if (s.length === 0) return [];
  const byNl = s.split('\n');
  if (byNl.length > 1) {
    if (byNl.length <= MAX_LINES_CAP) return byNl;
    return [
      ...byNl.slice(0, MAX_LINES_CAP),
      `… [truncated ${byNl.length - MAX_LINES_CAP} lines — use Download to save full body]`,
    ];
  }
  const line = byNl[0];
  if (line.length <= SOFT_WRAP_CHUNK) return [line];
  const chunks = [];
  for (let i = 0; i < line.length; i += SOFT_WRAP_CHUNK) {
    chunks.push(line.slice(i, i + SOFT_WRAP_CHUNK));
  }
  if (chunks.length > MAX_LINES_CAP) {
    return [
      ...chunks.slice(0, MAX_LINES_CAP),
      `… [truncated ${chunks.length - MAX_LINES_CAP} segments — open Pretty tab if JSON, or Download]`,
    ];
  }
  return chunks;
}

/**
 * Virtualized monospace body for large HTTP responses (production / DMG builds freeze without this).
 */
export default function VirtualizedResponseText({
  text,
  className = '',
  textClass = 'text-xs text-tx-secondary font-mono whitespace-pre-wrap break-all leading-snug',
}) {
  const containerRef = useRef(null);
  const [height, setHeight] = useState(480);
  const lines = useMemo(() => splitForVirtualDisplay(text), [text]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setHeight(Math.max(120, el.clientHeight)));
    ro.observe(el);
    setHeight(Math.max(120, el.clientHeight));
    return () => ro.disconnect();
  }, []);

  const Row = useCallback(
    ({ index, style }) => (
      <div style={style} className={`flex ${textClass} border-b border-[var(--border-1)] border-opacity-50`}>
        <span className="shrink-0 w-10 text-right pr-2 text-tx-muted select-none text-[10px] pt-0.5 border-r border-[var(--border-1)]">
          {index + 1}
        </span>
        <span className="pl-2 min-w-0 flex-1 py-0.5 selectable cursor-text">{lines[index] ?? ''}</span>
      </div>
    ),
    [lines, textClass],
  );

  return (
    <div ref={containerRef} className={`h-full min-h-0 flex flex-col response-mouse-select ${className}`}>
      <FixedSizeList
        height={height}
        width="100%"
        itemCount={lines.length}
        itemSize={ROW_PX}
        overscanCount={12}
      >
        {Row}
      </FixedSizeList>
    </div>
  );
}
