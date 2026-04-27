import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUIStore } from '@/store/uiStore';
import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useSocketStore } from '@/store/socketStore';
import { useAuthStore } from '@/store/authStore';
import { parsePostmanCollection } from '@/utils/postmanParser';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ImportModal() {
  const { setShowImportModal } = useUIStore();
  const { currentTeam } = useTeamStore();
  const { currentProject } = useProjectStore();
  const { fetchCollections, setCurrentCollection, fetchCollectionRequests } = useCollectionStore();
  const { emitCollectionImport } = useSocketStore();
  const { user } = useAuthStore();

  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [totalRequests, setTotalRequests] = useState(0);
  const [parseError, setParseError] = useState(null);
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'done'

  const onDrop = useCallback((acceptedFiles) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (!json.info || !json.item) {
          throw new Error('Not a valid Postman collection. Missing "info" or "item" fields.');
        }
        const result = parsePostmanCollection(json);
        setParsed({ ...result, rawJson: json });
        setStep('preview');
      } catch (err) {
        setParseError(err.message || 'Failed to parse JSON');
        setFile(null);
      }
    };
    reader.readAsText(f);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.json'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleImport = async () => {
    if (!parsed || !currentProject || !currentTeam) {
      toast.error('Select a project and team first');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setTotalRequests(parsed.requests.length);

    try {
      // 1. Initialize Collection
      const { data: initData } = await api.post('/api/import/init', {
        collectionMeta: parsed.collectionMeta,
        folders: parsed.folders,
        projectId: currentProject._id,
        teamId: currentTeam._id,
      });

      const collectionId = initData.collectionId;
      const collection = initData.collection;

      // 2. Upload chunks
      const CHUNK_SIZE = 50;
      let insertedCount = 0;
      
      for (let i = 0; i < parsed.requests.length; i += CHUNK_SIZE) {
        const chunk = parsed.requests.slice(i, i + CHUNK_SIZE);
        
        const { data: chunkData } = await api.post('/api/import/chunk', {
          collectionId,
          projectId: currentProject._id,
          teamId: currentTeam._id,
          requests: chunk,
        });
        
        insertedCount += chunkData.insertedCount || 0;
        setImportProgress(Math.min(i + CHUNK_SIZE, parsed.requests.length));
      }

      // Force refresh collections to get the newly imported collection
      await fetchCollections(currentProject._id, true);

      // Set the imported collection as current and fetch its requests
      if (collection) {
        setCurrentCollection(collection);
        await fetchCollectionRequests(collection._id, true);
        
        // Update expanded collections in localStorage
        const expanded = JSON.parse(localStorage.getItem('sidebar_expanded_collections') || '[]');
        if (!expanded.includes(collection._id)) {
          expanded.push(collection._id);
          localStorage.setItem('sidebar_expanded_collections', JSON.stringify(expanded));
        }
        
        // Dispatch event to trigger sidebar expansion (pass both collectionId and projectId)
        window.dispatchEvent(new CustomEvent('collection-imported', { 
          detail: { collectionId: collection._id, projectId: currentProject._id }
        }));
      }

      // Emit to real-time room
      emitCollectionImport(currentTeam._id, collection, insertedCount, user?.id);

      toast.success(`Imported "${collection.name}" — ${insertedCount} requests`);
      
      // Close modal
      setShowImportModal(false);
      
      setStep('done');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && setShowImportModal(false)}
    >
      <div className="bg-surface-1 border border-surface-700 rounded-2xl shadow-glass w-full max-w-lg animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            <h2 className="text-sm font-semibold text-tx-primary">Import Postman Collection</h2>
          </div>
          <button onClick={() => setShowImportModal(false)} className="text-surface-500 hover:text-tx-primary transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-5">
          {step === 'upload' && (
            <>
              <p className="text-surface-400 text-xs mb-4">
                Upload a Postman Collection v2 or v2.1 JSON file. Folders, headers, auth, and body will be fully imported.
              </p>

              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                  isDragActive
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-surface-700 hover:border-surface-600 hover:bg-surface-800/50'
                }`}
              >
                <input {...getInputProps()} />
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isDragActive ? 'bg-brand-500/20' : 'bg-surface-800'}`}>
                  <svg className={`w-6 h-6 ${isDragActive ? 'text-brand-400' : 'text-surface-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-tx-primary">
                    {isDragActive ? 'Drop your collection here' : 'Drag & drop or click to select'}
                  </p>
                  <p className="text-surface-500 text-xs mt-1">Postman Collection JSON, max 10MB</p>
                </div>
              </div>

              {parseError && (
                <div className="mt-3 flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
                  <svg className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <p className="text-danger text-xs">{parseError}</p>
                </div>
              )}
            </>
          )}

          {step === 'preview' && parsed && (
            <div className="flex flex-col gap-4">
              {/* Summary */}
              <div className="bg-surface-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-tx-primary">{parsed.collectionMeta.name}</h3>
                    {parsed.collectionMeta.description && (
                      <p className="text-surface-500 text-xs">{parsed.collectionMeta.description}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Stat icon="📁" label="Folders" value={parsed.folders.length} />
                  <Stat icon="📋" label="Requests" value={parsed.requests.length} />
                </div>
              </div>

              {/* Destination */}
              <div className="text-xs text-surface-400 bg-surface-800/50 rounded-xl px-3 py-2.5">
                Importing to: <span className="text-tx-primary font-medium">{currentTeam?.name}</span> → <span className="text-tx-primary font-medium">{currentProject?.name || '(No project selected)'}</span>
              </div>

              {!currentProject && (
                <p className="text-warning text-xs bg-warning/10 border border-warning/30 rounded-xl px-3 py-2">
                  ⚠️ Please select a project in the sidebar before importing.
                </p>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep('upload')} className="btn-ghost flex-1 text-xs">
                  ← Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={isImporting || !currentProject}
                  className="btn-primary flex-1 text-sm relative overflow-hidden"
                >
                  {isImporting && totalRequests > 0 && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-300"
                      style={{ width: `${(importProgress / totalRequests) * 100}%` }}
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isImporting ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                        {totalRequests > 0 ? `Importing ${importProgress} / ${totalRequests}...` : 'Importing...'}
                      </>
                    ) : `Import ${parsed.requests.length} Requests →`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-14 h-14 rounded-2xl bg-success/20 flex items-center justify-center border border-success/30">
                <svg className="w-7 h-7 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
              </div>
              <div className="text-center">
                <p className="text-tx-primary font-semibold">Import Successful!</p>
                <p className="text-surface-400 text-sm mt-1">{parsed.requests.length} requests imported to your collection.</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="btn-primary px-8">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="text-lg font-bold text-tx-primary">{value}</p>
        <p className="text-[10px] text-surface-500">{label}</p>
      </div>
    </div>
  );
}
