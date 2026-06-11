import { useState, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import ModalShell from '@/components/Modals/ModalShell';

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
    try {
      await onSave(name.trim());
    } finally {
      setLoading(false);
      setShowEditNameModal(false, null);
    }
  };

  const handleClose = () => {
    setShowEditNameModal(false, null);
    setName('');
  };

  return (
    <ModalShell onClose={handleClose} title={title} subtitle={`Rename ${itemType?.toLowerCase() || 'item'}`} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold text-tx-secondary mb-1.5">
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
          <button type="button" onClick={handleClose} className="btn-ghost flex-1">
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={loading || !name.trim()}>
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
