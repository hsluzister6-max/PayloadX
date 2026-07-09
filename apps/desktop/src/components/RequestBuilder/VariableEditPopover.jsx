import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useEnvironmentStore } from '@/store/environmentStore';

export default function VariableEditPopover({
  anchor,
  varName,
  variable,
  pinned = false,
  onClose,
  onHoverEnter,
  onHoverLeave,
}) {
  const { activeEnvironment, saveVariables, addVariable } = useEnvironmentStore();
  const popoverRef = useRef(null);
  const valueInputRef = useRef(null);
  const [draft, setDraft] = useState(variable?.value ?? '');
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setDraft(variable?.value ?? '');
  }, [variable?.value, varName]);

  useEffect(() => {
    // Don't steal focus from the URL bar on hover — only focus when pinned
    if (pinned) {
      valueInputRef.current?.focus();
      valueInputRef.current?.select();
    }
  }, [pinned, varName]);

  useEffect(() => {
    if (!anchor) return;

    const handlePointerDown = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      onClose?.();
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [anchor, onClose]);

  // Position BELOW the URL / token so it never covers the input
  useLayoutEffect(() => {
    if (!anchor || !popoverRef.current) return;
    const pop = popoverRef.current.getBoundingClientRect();
    const margin = 8;
    let left = anchor.x;
    let top = (anchor.y || 0) + (anchor.height || 0) + margin;

    left = Math.min(
      window.innerWidth - margin - pop.width / 2,
      Math.max(margin + pop.width / 2, left),
    );

    // If not enough room below, still prefer below when possible; clamp to viewport
    if (top + pop.height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - margin - pop.height);
    }

    setPos({ top, left });
  }, [anchor, varName, draft, pinned]);

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
  const nameStatusClass = variable ? 'is-set' : 'is-missing';

  return createPortal(
    <div
      ref={popoverRef}
      className="variable-edit-popover"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: 'translateX(-50%)',
        zIndex: 10000,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    >
      {/* Arrow points UP toward the URL bar */}
      <div className="variable-edit-popover-arrow variable-edit-popover-arrow--above" />
      <div className="variable-edit-popover-inner">
        <div className="variable-edit-popover-row">
          <code className={`variable-edit-popover-name ${nameStatusClass}`}>
            {`{{${varName}}}`}
          </code>
          <input
            ref={valueInputRef}
            type={variable?.isSecret && !showSecret ? 'password' : 'text'}
            className="variable-edit-popover-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onHoverEnter}
            placeholder="Value"
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
            title={variable ? 'Save value' : 'Add variable'}
          >
            {saving ? '…' : 'Save'}
          </button>
        </div>
        <div className="variable-edit-popover-foot">
          <span className="variable-edit-popover-env">{envLabel}</span>
          <span className="variable-edit-popover-foot-hint">
            Edit name in URL · value here · ↵ save · esc
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
