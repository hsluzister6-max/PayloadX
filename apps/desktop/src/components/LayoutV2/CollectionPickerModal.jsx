import { useEffect, useMemo, useState } from 'react';
import ModalShell from '@/components/Modals/ModalShell';

/**
 * Pick a collection when creating a request from the type filter.
 * @param {{
 *   open: boolean,
 *   protocolLabel: string,
 *   collections: Array<{ _id: string, name: string }>,
 *   onClose: () => void,
 *   onSelect: (collectionId: string) => void | Promise<void>,
 * }} props
 */
export default function CollectionPickerModal({
  open,
  protocolLabel = 'Request',
  collections = [],
  onClose,
  onSelect,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setQuery('');
    setSaving(false);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [collections, query]);

  if (!open) return null;

  const handleConfirm = async (collectionId = selectedId) => {
    if (!collectionId || saving) return;
    setSaving(true);
    try {
      await onSelect(collectionId);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      title="Choose collection"
      subtitle={`Create ${protocolLabel} request in…`}
      maxWidth="max-w-sm"
      zIndex={1300}
      bodyClassName="modal-body--compact"
    >
      {collections.length === 0 ? (
        <p className="text-[12px] text-tx-muted py-3 text-center">
          No collections in this project yet. Create a collection first.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search collections…"
            className="w-full h-9 px-3 rounded-md text-[12px] font-mono bg-[var(--surface-2)] border border-[var(--border-1)] text-tx-primary outline-none focus:border-[var(--accent)]"
            autoFocus
          />
          <div className="max-h-[240px] overflow-y-auto flex flex-col gap-0.5">
            {filtered.length === 0 ? (
              <p className="text-[11px] text-tx-muted py-3 text-center">No matching collections</p>
            ) : (
              filtered.map((col) => {
                const active = selectedId === col._id;
                return (
                  <button
                    key={col._id}
                    type="button"
                    onClick={() => setSelectedId(col._id)}
                    onDoubleClick={() => handleConfirm(col._id)}
                    className={`flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-md border transition-colors ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--surface-3)]'
                        : 'border-transparent hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-tx-muted shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="text-[12px] text-tx-primary truncate">{col.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <button type="button" onClick={onClose} disabled={saving} className="btn-ghost flex-1">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => handleConfirm()}
          disabled={!selectedId || saving || collections.length === 0}
          className={`btn-primary flex-1 ${(!selectedId || saving || collections.length === 0) ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {saving ? 'Creating…' : 'Create request'}
        </button>
      </div>
    </ModalShell>
  );
}
