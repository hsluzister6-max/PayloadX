import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useEnvironmentStore } from '@/store/environmentStore';

const CLOSE_DELAY_MS = 180;

export default function VariableEditPopover({
  anchor,
  varName,
  variable,
  onClose,
  onHoverEnter,
  onHoverLeave,
}) {
  const { activeEnvironment, saveVariables, addVariable } = useEnvironmentStore();
  const popoverRef = useRef(null);
  const [draft, setDraft] = useState(variable?.value ?? '');
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setDraft(variable?.value ?? '');
  }, [variable?.value, varName]);

  useLayoutEffect(() => {
    if (!anchor || !popoverRef.current) return;
    const pop = popoverRef.current.getBoundingClientRect();
    const margin = 6;
    let left = anchor.x + anchor.width / 2;
    let top = anchor.y - margin;

    left = Math.min(window.innerWidth - margin - pop.width / 2, Math.max(margin + pop.width / 2, left));
    top = Math.max(margin + pop.height, top);

    setPos({ top, left });
  }, [anchor, varName, draft]);

  const handleSave = useCallback(async () => {
    if (!activeEnvironment?._id) {
      toast.error('Select an environment first');
      return;
    }

    setSaving(true);
    try {
      const vars = [...(activeEnvironment.variables || [])];
      const idx = vars.findIndex((v) => v.key === varName);

      if (idx >= 0) {
        vars[idx] = { ...vars[idx], value: draft, enabled: vars[idx].enabled !== false };
        const result = await saveVariables(activeEnvironment._id, vars);
        if (result.success) {
          toast.success(`Updated {{${varName}}}`);
          onClose?.();
        } else {
          toast.error(result.error || 'Failed to save');
        }
      } else {
        const result = await addVariable(activeEnvironment._id, {
          key: varName,
          value: draft,
          enabled: true,
          isSecret: false,
        });
        if (result.success) {
          toast.success(`Added {{${varName}}}`);
          onClose?.();
        } else {
          toast.error(result.error || 'Failed to add variable');
        }
      }
    } finally {
      setSaving(false);
    }
  }, [activeEnvironment, addVariable, draft, onClose, saveVariables, varName]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose?.();
    }
  };

  if (!anchor) return null;

  const envLabel = activeEnvironment?.name || 'No env';

  return createPortal(
    <div
      ref={popoverRef}
      className="variable-edit-popover"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: 'translate(-50%, -100%)',
        zIndex: 10000,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    >
      <div className="variable-edit-popover-inner">
        <div className="variable-edit-popover-row">
          <code className={`variable-edit-popover-name ${variable ? 'is-set' : 'is-missing'}`}>
            {`{{${varName}}}`}
          </code>
          <input
            type={variable?.isSecret && !showSecret ? 'password' : 'text'}
            className="variable-edit-popover-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Value"
            autoFocus
          />
          {variable?.isSecret && (
            <button
              type="button"
              className="variable-edit-popover-icon-btn"
              onClick={() => setShowSecret((s) => !s)}
              title={showSecret ? 'Hide' : 'Show'}
            >
              {showSecret ? '◉' : '○'}
            </button>
          )}
          <button
            type="button"
            className="variable-edit-popover-save"
            onClick={handleSave}
            disabled={saving || !activeEnvironment}
            title={variable ? 'Save globally' : 'Add variable'}
          >
            {saving ? '…' : 'Save'}
          </button>
        </div>
        <div className="variable-edit-popover-foot">
          <span className="variable-edit-popover-env">{envLabel}</span>
          <span className="variable-edit-popover-foot-hint">↵ save · esc close</span>
        </div>
      </div>
      <div className="variable-edit-popover-arrow" />
    </div>,
    document.body,
  );
}

export function useVariablePopoverHover() {
  const [popover, setPopover] = useState(null);
  const closeTimer = useRef(null);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openPopover = (payload) => {
    clearCloseTimer();
    setPopover(payload);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setPopover(null), CLOSE_DELAY_MS);
  };

  const closePopover = () => {
    clearCloseTimer();
    setPopover(null);
  };

  useEffect(() => () => clearCloseTimer(), []);

  return { popover, openPopover, scheduleClose, closePopover, clearCloseTimer };
}
