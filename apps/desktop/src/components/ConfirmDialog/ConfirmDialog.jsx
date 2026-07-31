import { useEffect, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import ModalShell from '@/components/Modals/ModalShell';

export default function ConfirmDialog() {
  const { showConfirmDialog, confirmDialogConfig, setShowConfirmDialog } = useUIStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showConfirmDialog) setLoading(false);
  }, [showConfirmDialog, confirmDialogConfig]);

  if (!showConfirmDialog || !confirmDialogConfig) return null;

  const {
    title = 'Confirm',
    message,
    itemName,
    onConfirm,
    onCancel,
    confirmText = 'Delete',
    cancelText = 'Cancel',
    danger = true,
  } = confirmDialogConfig;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (onConfirm) {
        await onConfirm();
      }
    } catch (err) {
      console.error('Confirm action failed:', err);
    } finally {
      setLoading(false);
      setShowConfirmDialog(false, null);
    }
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    setShowConfirmDialog(false, null);
  };

  const dangerIcon = (
    <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );

  const infoIcon = (
    <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );

  return (
    <ModalShell
      onClose={handleCancel}
      title={title}
      subtitle={danger ? 'This action may be irreversible' : 'Please confirm to continue'}
      maxWidth="max-w-sm"
      zIndex={10050}
      icon={danger ? dangerIcon : infoIcon}
      bodyClassName="modal-body--compact"
    >
      {message && <p className="text-sm text-tx-secondary mb-2">{message}</p>}
      {itemName && (
        <p className="text-sm font-medium text-tx-primary mb-4 bg-[var(--surface-2)] border border-[var(--border-1)] px-3 py-2 rounded-lg">
          {itemName}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={handleCancel} disabled={loading} className="btn-ghost flex-1">
          {cancelText}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className={`flex-1 py-2 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
            danger ? 'bg-danger text-white hover:bg-danger/90' : 'btn-primary'
          } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {confirmText === 'Delete' ? 'Deleting...' : 'Processing...'}
            </>
          ) : (
            confirmText
          )}
        </button>
      </div>
    </ModalShell>
  );
}
