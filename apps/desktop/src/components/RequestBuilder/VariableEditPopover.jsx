import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useEnvironmentStore } from '@/store/environmentStore';

const CLOSE_DELAY_MS = 180;

export default function VariableEditPopover({
  anchor,
  varName,
  variable,
  pinned = false,
  onClose,
  onHoverEnter,
  onHoverLeave,
  onReplaceInUrl,
}) {
  const { activeEnvironment, saveVariables, addVariable } = useEnvironmentStore();
  const popoverRef = useRef(null);
  const keyInputRef = useRef(null);
  const valueInputRef = useRef(null);
  const [draftKey, setDraftKey] = useState(varName);
  const [draft, setDraft] = useState(variable?.value ?? '');
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setDraftKey(varName);
    setDraft(variable?.value ?? '');
  }, [variable?.value, varName]);

  useEffect(() => {
    if (pinned) {
      keyInputRef.current?.focus();
      keyInputRef.current?.select();
    } else {
      valueInputRef.current?.focus();
    }
  }, [pinned, varName]);

  useEffect(() => {
    if (!anchor) return;

    const handlePointerDown = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      if (e.target.closest?.('[data-var-token]')) return;
      onClose?.();
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [anchor, onClose]);

  useLayoutEffect(() => {
    if (!anchor || !popoverRef.current) return;
    const pop = popoverRef.current.getBoundingClientRect();
    const margin = 6;
    let left = anchor.x + anchor.width / 2;
    let top = anchor.y - margin;

    left = Math.min(window.innerWidth - margin - pop.width / 2, Math.max(margin + pop.width / 2, left));
    top = Math.max(margin + pop.height, top);

    setPos({ top, left });
  }, [anchor, varName, draft, draftKey, pinned]);

  const handleSave = useCallback(async () => {
    if (!activeEnvironment?._id) {
      toast.error('Select an environment first');
      return;
    }

    const newKey = draftKey.trim();
    if (!newKey) {
      toast.error('Variable name is required');
      return;
    }
    if (/[{}]/.test(newKey) || /\s/.test(newKey)) {
      toast.error('Variable name cannot contain spaces or braces');
      return;
    }

    setSaving(true);
    try {
      const vars = [...(activeEnvironment.variables || [])];
      const idx = vars.findIndex((v) => v.key === varName);

      if (idx >= 0) {
        if (newKey !== varName) {
          const dup = vars.findIndex((v) => v.key === newKey);
          if (dup >= 0 && dup !== idx) {
            toast.error(`Variable "${newKey}" already exists`);
            return;
          }
          vars[idx] = {
            ...vars[idx],
            key: newKey,
            value: draft,
            enabled: vars[idx].enabled !== false,
          };
        } else {
          vars[idx] = { ...vars[idx], value: draft, enabled: vars[idx].enabled !== false };
        }
        const result = await saveVariables(activeEnvironment._id, vars);
        if (result.success) {
          if (newKey !== varName && onReplaceInUrl) {
            onReplaceInUrl(varName, newKey);
          }
          toast.success(`Updated {{${newKey}}}`);
          onClose?.();
        } else {
          toast.error(result.error || 'Failed to save');
        }
      } else {
        const result = await addVariable(activeEnvironment._id, {
          key: newKey,
          value: draft,
          enabled: true,
          isSecret: false,
        });
        if (result.success) {
          if (newKey !== varName && onReplaceInUrl) {
            onReplaceInUrl(varName, newKey);
          }
          toast.success(`Added {{${newKey}}}`);
          onClose?.();
        } else {
          toast.error(result.error || 'Failed to add variable');
        }
      }
    } finally {
      setSaving(false);
    }
  }, [
    activeEnvironment,
    addVariable,
    draft,
    draftKey,
    onClose,
    onReplaceInUrl,
    saveVariables,
    varName,
  ]);

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
        transform: 'translate(-50%, -100%)',
        zIndex: 10000,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    >
      <div className="variable-edit-popover-inner">
        {pinned ? (
          <div className="variable-edit-popover-stack">
            <div className="variable-edit-popover-field-row">
              <span className="variable-edit-popover-field-label">Name</span>
              <div className="variable-edit-popover-brace-row">
                <span className="variable-edit-popover-brace">{'{{'}</span>
                <input
                  ref={keyInputRef}
                  type="text"
                  className="variable-edit-popover-input variable-edit-popover-key-input"
                  value={draftKey}
                  onChange={(e) => setDraftKey(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="variable_name"
                  spellCheck={false}
                />
                <span className="variable-edit-popover-brace">{'}}'}</span>
              </div>
            </div>
            <div className="variable-edit-popover-field-row">
              <span className="variable-edit-popover-field-label">Value</span>
              <div className="variable-edit-popover-value-row">
                <input
                  ref={valueInputRef}
                  type={variable?.isSecret && !showSecret ? 'password' : 'text'}
                  className="variable-edit-popover-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
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
                  title={variable ? 'Save globally' : 'Add variable'}
                >
                  {saving ? '…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : (
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
              title={variable ? 'Save globally' : 'Add variable'}
            >
              {saving ? '…' : 'Save'}
            </button>
          </div>
        )}
        <div className="variable-edit-popover-foot">
          <span className="variable-edit-popover-env">{envLabel}</span>
          <span className="variable-edit-popover-foot-hint">
            {pinned ? '↵ save · esc · click outside to close' : '↵ save · esc · click var to rename'}
          </span>
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
    closeTimer.current = setTimeout(() => {
      setPopover(null);
    }, CLOSE_DELAY_MS);
  };

  const closePopover = () => {
    clearCloseTimer();
    setPopover(null);
  };

  useEffect(() => () => clearCloseTimer(), []);

  return { popover, openPopover, scheduleClose, closePopover, clearCloseTimer };
}
