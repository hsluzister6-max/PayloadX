import { useState, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';

export default function EditNameModal() {
  const { showEditNameModal, editNameModalConfig, setShowEditNameModal } = useUIStore();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showEditNameModal && editNameModalConfig) {
      setName(editNameModalConfig.currentName || '');
    }
  }, [showEditNameModal, editNameModalConfig]);

  if (!showEditNameModal || !editNameModalConfig) return null;

  const { title, itemType, onSave } = editNameModalConfig;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    await onSave(name.trim());
    setLoading(false);
    setShowEditNameModal(false, null);
  };

  const handleClose = () => {
    setShowEditNameModal(false, null);
    setName('');
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-surface-1 border border-surface-700 rounded-2xl shadow-glass w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700">
          <h2 className="text-sm font-semibold text-tx-primary">{title}</h2>
          <button onClick={handleClose} className="text-surface-500 hover:text-tx-primary transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-surface-400 mb-1.5">
                {itemType} Name
              </label>
              <input
                className="input"
                placeholder={`Enter ${itemType.toLowerCase()} name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={loading || !name.trim()}
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
