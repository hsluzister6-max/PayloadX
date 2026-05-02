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

    if (!f.name.toLowerCase().endsWith('.json')) {
      setParseError('Only .json files are supported.');
      setFile(null);
      return;
    }

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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
      onClick={(e) => e.target === e.currentTarget && setShowImportModal(false)}
    >
      <div className="bg-[#0b0d13]/95 backdrop-blur-2xl border border-white/5 rounded-[28px] shadow-[0_0_80px_rgba(0,0,0,0.9)] w-full max-w-lg animate-in zoom-in-95 duration-300 overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gray-400 to-transparent opacity-50"></div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 relative z-10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-surface-600 to-surface-800 flex items-center justify-center border border-white/10 shadow-inner">
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
            </div>
            <h2 className="text-sm font-bold bg-gradient-to-r from-gray-200 via-gray-400 to-gray-500 bg-clip-text text-transparent uppercase tracking-wider">
              Import Collection
            </h2>
          </div>
          <button onClick={() => setShowImportModal(false)} className="text-surface-500 hover:text-gray-200 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-6 relative z-10">
          {step === 'upload' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <p className="text-surface-400 text-xs mb-5">
                Upload a Postman Collection v2 or v2.1 JSON file. Folders, headers, auth, and body will be fully imported.
              </p>

              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`relative rounded-xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-500 overflow-hidden group ${
                  isDragActive
                    ? 'border-transparent shadow-[0_0_30px_rgba(156,163,176,0.3)] scale-[1.02]'
                    : 'border-2 border-dashed border-white/10 hover:border-white/20 hover:bg-white/5 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                }`}
              >
                {/* Drag Active Glowing Border & Background */}
                {isDragActive && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-500/10 via-transparent to-gray-400/10 animate-pulse"></div>
                    <div className="absolute inset-0 rounded-xl border-2 border-transparent bg-gradient-to-r from-gray-400 via-gray-200 to-gray-500 opacity-50" style={{ WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', padding: '2px' }}></div>
                  </>
                )}
                
                <input {...getInputProps()} />
                <div className={`relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-xl ${
                  isDragActive 
                    ? 'bg-gradient-to-br from-gray-700 to-gray-900 border border-gray-400/50 scale-110' 
                    : 'bg-white/5 border border-white/5 group-hover:scale-105'
                }`}>
                  <svg className={`w-8 h-8 transition-colors duration-300 ${isDragActive ? 'text-gray-200 animate-bounce' : 'text-surface-500 group-hover:text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                  </svg>
                </div>
                <div className="text-center relative z-10">
                  <p className={`text-base font-semibold transition-colors duration-300 ${isDragActive ? 'text-gray-200' : 'text-tx-primary'}`}>
                    {isDragActive ? 'Drop to Supercharge ⚡' : 'Drag & drop or click to select'}
                  </p>
                  <p className="text-surface-500 text-xs mt-1.5 font-medium tracking-wide uppercase">Postman JSON • Max 10MB</p>
                </div>
              </div>

              {parseError && (
                <div className="mt-4 flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 animate-in slide-in-from-top-2">
                  <svg className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <p className="text-danger text-xs">{parseError}</p>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && parsed && (
            <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {/* Summary */}
              <div className="bg-white/5 rounded-2xl p-5 shadow-inner">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center border border-gray-500/30 shadow-md">
                    <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold bg-gradient-to-r from-gray-200 via-gray-300 to-gray-500 bg-clip-text text-transparent">{parsed.collectionMeta.name}</h3>
                    {parsed.collectionMeta.description && (
                      <p className="text-surface-400 text-xs mt-0.5 line-clamp-1">{parsed.collectionMeta.description}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Stat icon="📁" label="Folders" value={parsed.folders.length} />
                  <Stat icon="📋" label="Requests" value={parsed.requests.length} />
                </div>
              </div>

              {/* Destination */}
              <div className="text-[11px] text-surface-500 bg-black/20 rounded-xl px-4 py-3.5 flex items-center gap-2">
                <svg className="w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span>Importing to: <span className="text-gray-300 font-semibold">{currentTeam?.name}</span> → <span className="text-gray-300 font-semibold">{currentProject?.name || '(No project selected)'}</span></span>
              </div>

              {!currentProject && (
                <p className="text-warning text-xs bg-warning/10 border border-warning/30 rounded-xl px-3 py-2 animate-pulse">
                  ⚠️ Please select a project in the sidebar before importing.
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep('upload')} className="px-5 py-2.5 rounded-lg font-semibold bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-surface-300 hover:text-white flex-1 text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={isImporting || !currentProject}
                  className="btn-primary flex-[2] text-sm relative overflow-hidden group shadow-[0_0_15px_rgba(156,163,176,0.2)] disabled:opacity-50 disabled:shadow-none"
                >
                  {isImporting && totalRequests > 0 && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-gray-500 via-gray-300 to-gray-400 opacity-40 transition-all duration-300 ease-out"
                      style={{ width: `${(importProgress / totalRequests) * 100}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isImporting ? (
                      <>
                        <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                        <span className="font-bold tracking-wide">
                          {totalRequests > 0 ? `Importing ${importProgress} / ${totalRequests}...` : 'Importing...'}
                        </span>
                      </>
                    ) : (
                      <span className="font-bold tracking-wide flex items-center gap-2">
                        Supercharge {parsed.requests.length} Requests 
                        <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                      </span>
                    )}
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-5 py-8 animate-in zoom-in-95 duration-500">
              <div className="relative">
                <div className="absolute inset-0 bg-gray-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-surface-700 to-surface-900 flex items-center justify-center border-2 border-gray-400/30 shadow-[0_0_20px_rgba(156,163,176,0.15)]">
                  <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold bg-gradient-to-r from-gray-200 via-gray-400 to-gray-500 bg-clip-text text-transparent">Import Successful!</p>
                <p className="text-surface-400 text-sm mt-2">{parsed.requests.length} requests successfully supercharged.</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="mt-2 px-10 py-2.5 rounded-lg font-semibold bg-gradient-to-b from-surface-600 to-surface-800 border border-surface-500/50 hover:from-surface-500 hover:to-surface-700 transition-all shadow-md text-gray-200 hover:text-white">
                Awesome
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="flex-1 flex items-center gap-3 bg-surface-800/30 rounded-xl p-3 hover:bg-surface-800/60 transition-all duration-300">
      <div className="w-10 h-10 rounded-lg bg-[#07090d] flex items-center justify-center text-lg shadow-inner">
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent leading-none mb-1">{value}</p>
        <p className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">{label}</p>
      </div>
    </div>
  );
}
