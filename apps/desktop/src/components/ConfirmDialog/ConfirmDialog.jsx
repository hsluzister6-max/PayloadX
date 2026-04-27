import { useState } from 'react';
import { useUIStore } from '@/store/uiStore';

export default function ConfirmDialog() {
  const { showConfirmDialog, confirmDialogConfig, setShowConfirmDialog } = useUIStore();
  const [loading, setLoading] = useState(false);

  if (!showConfirmDialog || !confirmDialogConfig) return null;

  const { title, message, itemName, onConfirm, onCancel, confirmText = 'Delete', danger = true } = confirmDialogConfig;

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

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && handleCancel()}
    >
      <div className="bg-surface-1 border border-surface-700 rounded-2xl shadow-glass w-full max-w-sm animate-slide-up">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            {danger && (
              <div className="w-10 h-10 rounded-full bg-danger/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            )}
            <h2 className="text-sm font-semibold text-tx-primary">{title}</h2>
          </div>

          <p className="text-sm text-surface-400 mb-2">
            {message}
          </p>
          {itemName && (
            <p className="text-sm font-medium text-tx-primary mb-4 bg-surface-800 px-3 py-2 rounded-lg">
              {itemName}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCancel}
              className="btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`flex-1 py-2 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${danger
                ? 'bg-danger text-white hover:bg-danger/90'
                : 'btn-primary'
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
        </div>
      </div>
    </div>
  );
}
