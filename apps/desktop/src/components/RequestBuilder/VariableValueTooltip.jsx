import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUIStore } from '@/store/uiStore';

/**
 * Minimal hover tip for {{env}} tokens — value only; click opens Environments.
 */
export default function VariableValueTooltip({
  anchor,
  varName,
  variable,
  envName,
  onMouseEnter,
  onMouseLeave,
  onClose,
}) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const openRightSidebarTab = useUIStore((s) => s.openRightSidebarTab);

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const pop = ref.current.getBoundingClientRect();
    const margin = 8;
    let left = anchor.x;
    let top = (anchor.y || 0) + (anchor.height || 14) + 6;

    left = Math.min(
      window.innerWidth - margin - pop.width / 2,
      Math.max(margin + pop.width / 2, left),
    );

    if (top + pop.height > window.innerHeight - margin) {
      top = Math.max(margin, (anchor.y || 0) - pop.height - 6);
    }

    setPos({ top, left });
  }, [anchor, varName, variable?.value]);

  if (!anchor || !varName) return null;

  const found = Boolean(variable);
  const isSecret = Boolean(variable?.isSecret);
  const raw = variable?.value ?? '';
  const display =
    !found
      ? 'Not set'
      : raw === ''
        ? '(empty)'
        : isSecret
          ? '••••••••'
          : raw.length > 64
            ? `${raw.slice(0, 61)}…`
            : raw;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openRightSidebarTab('environment');
    onClose?.();
  };

  return createPortal(
    <button
      type="button"
      ref={ref}
      className={`var-tip ${found ? 'var-tip--set' : 'var-tip--missing'}`}
      style={{ top: pos.top, left: pos.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={handleClick}
      title="Open environment"
      aria-label={`Open environment — ${varName}`}
    >
      <span className="var-tip__arrow" aria-hidden />
      <span className="var-tip__value" title={found && !isSecret ? raw : undefined}>
        {display}
      </span>
      {envName ? <span className="var-tip__env">{envName}</span> : null}
    </button>,
    document.body,
  );
}
