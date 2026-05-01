import { useUIStore } from '@/store/uiStore';
import { useRequestStore } from '@/store/requestStore';
import toast from 'react-hot-toast';

export default function UnsavedChangesModal() {
  const { showUnsavedModal, unsavedModalConfig, setShowUnsavedModal } = useUIStore();
  const { saveRequest } = useRequestStore();

  if (!showUnsavedModal || !unsavedModalConfig) return null;

  const { tabId, requestName, onSave, onDontSave, onCancel } = unsavedModalConfig;

  const handleSave = async () => {
    try {
      if (onSave) {
        await onSave();
      } else {
        const result = await saveRequest();
        if (!result.success) {
          toast.error(result.error || 'Failed to save changes');
          return;
        }
      }
      setShowUnsavedModal(false);
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('Failed to save changes');
    }
  };

  const handleDontSave = () => {
    if (onDontSave) onDontSave();
    setShowUnsavedModal(false);
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    setShowUnsavedModal(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/25 z-[100] flex items-center justify-center p-4 backdrop-blur-md"
      onClick={(e) => e.target === e.currentTarget && handleCancel()}
    >
      <div className="metallic-card rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-full max-w-[280px] animate-in fade-in zoom-in duration-200 border border-white/10">
        <div className="p-5">
          <div className="flex flex-col items-center text-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center border border-warning/20 shadow-[0_0_15px_rgba(254,188,46,0.1)]">
              <svg className="w-4 h-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-[11px] font-black text-tx-primary tracking-widest uppercase" style={{ fontFamily: 'Syne, sans-serif' }}>Save Changes?</h2>
              <p className="text-[9px] text-tx-muted mt-1 px-2 leading-relaxed font-medium">Save <span className="text-tx-secondary font-bold">{requestName || 'Untitled'}</span> before closing?</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleSave}
              className="btn-primary w-full h-8 !text-[9px] !font-black !rounded-lg shadow-lg active:scale-[0.97] flex items-center justify-center gap-2 tracking-widest"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" /></svg>
              SAVE CHANGES
            </button>

            <button
              onClick={handleDontSave}
              className="btn-ghost w-full h-8 !text-[9px] !font-black !rounded-lg !border-border-1 hover:!bg-danger/10 hover:!text-danger hover:!border-danger/30 transition-all active:scale-[0.97] uppercase tracking-widest"
            >
              DON'T SAVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
