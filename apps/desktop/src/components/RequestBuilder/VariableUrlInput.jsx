import { useMemo, useRef } from 'react';
import { useEnvironmentStore } from '@/store/environmentStore';
import VariableEditPopover, { useVariablePopoverHover } from './VariableEditPopover';

function replaceVariableTokenInUrl(url, oldName, newKey) {
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, 'g');
  return url.replace(regex, `{{${newKey}}}`);
}

export default function VariableUrlInput({ value, onChange, placeholder }) {
  const { activeEnvironment } = useEnvironmentStore();
  const inputRef = useRef(null);
  const { popover, openPopover, scheduleClose, closePopover, clearCloseTimer } =
    useVariablePopoverHover();

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

  const openForSegment = (seg, e, pinned = false) => {
    const rect = e.currentTarget.getBoundingClientRect();
    openPopover({
      varName: seg.varName,
      variable: seg.variable,
      pinned,
      anchor: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    });
  };

  const handleVarEnter = (seg, e) => {
    if (popover?.pinned) return;
    openForSegment(seg, e, false);
  };

  const handleVarClick = (seg, e) => {
    e.preventDefault();
    e.stopPropagation();
    clearCloseTimer();
    if (popover?.varName === seg.varName && popover?.pinned) return;
    openForSegment(seg, e, true);
  };

  const handleReplaceInUrl = (oldName, newKey) => {
    const newUrl = replaceVariableTokenInUrl(value, oldName, newKey);
    if (newUrl !== value) {
      onChange({ target: { value: newUrl } });
    }
  };

  return (
    <div className="relative flex-1 min-w-0 h-full">
      <div
        className={`flex items-center w-full h-full px-2.5 font-mono text-xs outline-none transition-all duration-150 ${
          hasUnresolved ? 'bg-warning/10' : 'bg-transparent'
        }`}
      >
        <div className="w-full overflow-x-auto whitespace-pre custom-scrollbar pb-0.5" style={{ lineHeight: '1.25rem' }}>
          <div className="relative min-w-full w-max">
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
                      data-var-token
                      className={`pointer-events-auto cursor-pointer transition-opacity hover:opacity-75 ${
                        seg.found ? 'text-green-500' : 'text-orange-400'
                      }`}
                      onMouseEnter={(e) => handleVarEnter(seg, e)}
                      onMouseLeave={scheduleClose}
                      onClick={(e) => handleVarClick(seg, e)}
                      title={`Hover: edit value · Click: rename {{${seg.varName}}}`}
                    >
                      {seg.text}
                    </span>
                  ),
                )
              )}
            </div>

            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={value}
              onChange={onChange}
              className="absolute inset-0 z-0 bg-transparent border-0 outline-0 font-mono text-xs pl-0 pr-0"
              style={{
                color: 'transparent',
                caretColor: 'var(--text-primary)',
                letterSpacing: 'inherit',
                width: '100%',
                height: '100%',
              }}
              spellCheck={false}
              autoComplete="off"
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
          pinned={popover.pinned}
          onClose={closePopover}
          onHoverEnter={clearCloseTimer}
          onHoverLeave={scheduleClose}
          onReplaceInUrl={handleReplaceInUrl}
        />
      )}
    </div>
  );
}
