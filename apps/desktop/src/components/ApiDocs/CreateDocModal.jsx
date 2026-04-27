import { useState } from 'react';
import { useApiDocStore } from '@/store/apiDocStore';
import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';

export default function CreateDocModal({ onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [baseUrl, setBaseUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { createDoc } = useApiDocStore();
  const { currentTeam } = useTeamStore();
  const { currentProject } = useProjectStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !currentTeam || !currentProject) return;

    setIsLoading(true);
    const doc = await createDoc({
      name: name.trim(),
      description: description.trim(),
      version: version.trim() || '1.0.0',
      baseUrl: baseUrl.trim(),
      teamId: currentTeam._id,
      projectId: currentProject._id,
    });
    setIsLoading(false);

    if (doc) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div 
        className="w-full max-w-md rounded-xl bg-surface-1 border border-[var(--border-1)] shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="px-5 py-4 border-b border-[var(--border-1)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-tx-primary">Create API Documentation</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-tx-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-surface-400">Documentation Name <span className="text-error">*</span></label>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. User Service API"
              className="w-full px-3 py-2 bg-surface-2 border border-[var(--border-1)] rounded-lg text-sm text-tx-primary placeholder-surface-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-surface-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief overview of this API..."
              rows={3}
              className="w-full px-3 py-2 bg-surface-2 border border-[var(--border-1)] rounded-lg text-sm text-tx-primary placeholder-surface-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-surface-400">Version</label>
              <input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="w-full px-3 py-2 bg-surface-2 border border-[var(--border-1)] rounded-lg text-sm text-tx-primary placeholder-surface-500 focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-surface-400">Base URL</label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
                className="w-full px-3 py-2 bg-surface-2 border border-[var(--border-1)] rounded-lg text-sm text-tx-primary placeholder-surface-500 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-tx-secondary hover:text-tx-primary bg-transparent rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover active:bg-accent-active disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm"
            >
              {isLoading ? 'Creating...' : 'Create Doc'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
