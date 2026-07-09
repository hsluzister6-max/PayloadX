import { useCallback, useMemo, useRef } from 'react';
import { useEnvironmentStore } from '@/store/environmentStore';
import VariableEditPopover from './VariableEditPopover';
import { useVariablePopoverHover } from './useVariablePopoverHover';

/** Map mouse X → character index in a monospace-ish input (binary search on measured text). */
function charIndexAtClientX(input, clientX) {
  if (!input) return 0;
  const value = input.value || '';
  if (!value) return 0;

  const style = window.getComputedStyle(input);
  const canvas = charIndexAtClientX._canvas || (charIndexAtClientX._canvas = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`.trim();

  const rect = input.getBoundingClientRect();
  const padLeft = parseFloat(style.paddingLeft) || 0;
  const target = clientX - rect.left - padLeft + (input.scrollLeft || 0);
  if (target <= 0) return 0;

  let lo = 0;
  let hi = value.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(value.slice(0, mid)).width <= target) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function findVarAtIndex(value, index, activeEnvironment) {
  const regex = /\{\{[^}]+\}\}/g;
  let m;
  while ((m = regex.exec(value)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    if (index >= start && index < end) {
      const varName = m[0].slice(2, -2).trim();
      const variable = activeEnvironment?.variables?.find(
        (v) => v.key === varName && v.enabled !== false,
      );
      return {
        varName,
        variable: variable || null,
        found: Boolean(variable),
        start,
        end,
        text: m[0],
      };
    }
  }
  return null;
}

export default function VariableUrlInput({ value, onChange, placeholder }) {
  const { activeEnvironment } = useEnvironmentStore();
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const { popover, openPopover, scheduleClose, closePopover, clearCloseTimer } =
    useVariablePopoverHover();

  // Don't let the hover popover pop up under the cursor while the user is
  // actively typing — only show it once typing pauses (or on genuine hover).
  const handleUrlChange = (e) => {
    isTypingRef.current = true;
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { isTypingRef.current = false; }, 500);
    onChange(e);
  };

  const segments = useMemo(() => {
    const parts = [];
    const regex = /(\{\{[^}]+\}\})/g;
    let last = 0;
    let m;
    while ((m = regex.exec(value)) !== null) {
      if (m.index > last) parts.push({ type: 'text', text: value.slice(last, m.index) });
      const varName = m[1].slice(2, -2).trim();
      const variable = activeEnvironment?.variables?.find(
        (v) => v.key === varName && v.enabled !== false,
      );
      parts.push({
        type: 'var',
        text: m[1],
        varName,
        found: Boolean(variable),
        variable: variable || null,
      });
      last = m.index + m[1].length;
    }
    if (last < value.length) parts.push({ type: 'text', text: value.slice(last) });
    return parts;
  }, [value, activeEnvironment]);

  const hasUnresolved = segments.some((s) => s.type === 'var' && !s.found);

  const openValuePopoverForVar = useCallback(
    (hit, clientX) => {
      const input = inputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      // Anchor under the hovered token — prefer measured token center when possible
      const style = window.getComputedStyle(input);
      const canvas = charIndexAtClientX._canvas || (charIndexAtClientX._canvas = document.createElement('canvas'));
      const ctx = canvas.getContext('2d');
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`.trim();
      const padLeft = parseFloat(style.paddingLeft) || 0;
      const startX = ctx.measureText(value.slice(0, hit.start)).width;
      const endX = ctx.measureText(value.slice(0, hit.end)).width;
      const tokenCenter = rect.left + padLeft - (input.scrollLeft || 0) + (startX + endX) / 2;

      openPopover({
        varName: hit.varName,
        variable: hit.variable,
        pinned: false,
        anchor: {
          x: Number.isFinite(tokenCenter) ? tokenCenter : clientX,
          y: rect.bottom,
          width: Math.max(8, endX - startX),
          height: 0,
        },
      });
    },
    [openPopover, value],
  );

  const handleMouseMove = (e) => {
    if (popover?.pinned) return;
    if (isTypingRef.current) return;
    const input = inputRef.current;
    if (!input) return;
    const idx = charIndexAtClientX(input, e.clientX);
    const hit = findVarAtIndex(value, idx, activeEnvironment);
    if (hit) {
      clearCloseTimer();
      if (popover?.varName !== hit.varName) {
        openValuePopoverForVar(hit, e.clientX);
      }
    } else if (popover && !popover.pinned) {
      scheduleClose();
    }
  };

  const handleMouseLeave = (e) => {
    // Don't close if moving into the popover portal
    const related = e.relatedTarget;
    if (related?.closest?.('.variable-edit-popover')) return;
    scheduleClose();
  };

  return (
    <div className="relative flex-1 min-w-0 h-full" ref={wrapRef}>
      <div
        className={`flex items-center w-full h-full px-2.5 font-mono text-xs outline-none transition-all duration-150 ${
          hasUnresolved ? 'bg-warning/10' : 'bg-transparent'
        }`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="w-full overflow-x-auto whitespace-pre custom-scrollbar pb-0.5" style={{ lineHeight: '1.25rem' }}>
          <div className="relative min-w-full w-max">
            {/* Highlight layer — visual only, never steals clicks from the URL input */}
            <div aria-hidden="true" className="relative z-[1] pointer-events-none select-none">
              {value === '' ? (
                <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>
              ) : (
                segments.map((seg, i) =>
                  seg.type === 'text' ? (
                    <span key={i} className="text-tx-primary">{seg.text}</span>
                  ) : (
                    <span
                      key={i}
                      className={seg.found ? 'text-green-500' : 'text-orange-400'}
                    >
                      {seg.text}
                    </span>
                  ),
                )
              )}
            </div>

            {/* Real URL input — always editable (Postman-style) */}
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={value}
              onChange={handleUrlChange}
              className="absolute inset-0 z-[2] bg-transparent border-0 outline-0 font-mono text-xs pl-0 pr-0"
              style={{
                color: 'transparent',
                caretColor: 'var(--text-primary)',
                letterSpacing: 'inherit',
                width: '100%',
                height: '100%',
              }}
              spellCheck={false}
              autoComplete="off"
              title="Edit URL freely. Hover a {{variable}} to edit its environment value."
            />
          </div>
        </div>

        {hasUnresolved && (
          <span className="ml-1.5 text-orange-400 text-xs flex-shrink-0" title="Variable not in environment">
            ⚠
          </span>
        )}
      </div>

      {popover && (
        <VariableEditPopover
          anchor={popover.anchor}
          varName={popover.varName}
          variable={popover.variable}
          pinned={false}
          onClose={closePopover}
          onHoverEnter={clearCloseTimer}
          onHoverLeave={scheduleClose}
        />
      )}
    </div>
  );
}
