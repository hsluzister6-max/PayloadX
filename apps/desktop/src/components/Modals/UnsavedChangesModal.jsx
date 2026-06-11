import { useUIStore } from '@/store/uiStore';
import { useRequestStore } from '@/store/requestStore';
import toast from 'react-hot-toast';
import ModalShell from '@/components/Modals/ModalShell';

export default function UnsavedChangesModal() {
  const { showUnsavedModal, unsavedModalConfig, setShowUnsavedModal } = useUIStore();
  const { saveRequest } = useRequestStore();

  if (!showUnsavedModal || !unsavedModalConfig) return null;

  const { requestName, onSave, onDontSave, onCancel } = unsavedModalConfig;

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

  const warnIcon = (
    <svg className="w-4 h-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );

  return (
    <ModalShell
      onClose={handleCancel}
      title="Save Changes?"
      subtitle="Unsaved request"
      maxWidth="max-w-[320px]"
      icon={warnIcon}
      bodyClassName="modal-body--compact"
      zIndex={100}
    >
      <p className="text-[11px] text-tx-muted text-center mb-5 leading-relaxed">
        Save <span className="text-tx-primary font-bold">{requestName || 'Untitled'}</span> before closing?
      </p>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="btn-primary w-full h-9 !text-[10px] !font-black !rounded-lg flex items-center justify-center gap-2 tracking-widest"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" /></svg>
          SAVE CHANGES
        </button>

        <button
          type="button"
          onClick={handleDontSave}
          className="btn-ghost w-full h-9 !text-[10px] !font-black !rounded-lg hover:!bg-danger/10 hover:!text-danger hover:!border-danger/30 uppercase tracking-widest"
        >
          DON&apos;T SAVE
        </button>
      </div>
    </ModalShell>
  );
}
