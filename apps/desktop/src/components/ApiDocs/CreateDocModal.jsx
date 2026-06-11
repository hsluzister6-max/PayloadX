import { useState } from 'react';
import { useApiDocStore } from '@/store/apiDocStore';
import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';
import ModalShell from '@/components/Modals/ModalShell';

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
    <ModalShell
      onClose={onClose}
      title="Create API Documentation"
      subtitle="New documentation"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-tx-secondary">Documentation Name <span className="text-danger">*</span></label>
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. User Service API"
            className="input !h-auto !py-2"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-tx-secondary">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief overview of this API..."
            rows={3}
            className="input !h-auto min-h-[80px] resize-none !py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-tx-secondary">Version</label>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
              className="input !h-auto !py-2"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-tx-secondary">Base URL</label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com"
              className="input !h-auto !py-2"
            />
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={!name.trim() || isLoading} className="btn-primary">
            {isLoading ? 'Creating...' : 'Create Doc'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
