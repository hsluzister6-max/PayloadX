import { useState, useEffect } from 'react';
import { X, Check, Search, Plus, Folder, Zap, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';

export default function SyncSidebar({ diff, currentProject, onClose, onSync }) {
  const [selectedRoutes, setSelectedRoutes] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (diff) {
      // Auto-select all new routes by default
      setSelectedRoutes(diff.newRoutes.map(r => r.path + r.method));
    }
  }, [diff]);

  useEffect(() => {
    if (currentProject) {
      fetchCollections();
    }
  }, [currentProject]);

  const fetchCollections = async () => {
    try {
      const { data } = await api.get(`/api/collection?projectId=${currentProject._id}`);
      setCollections(data.collections || []);
      if (data.collections?.length > 0) {
        setSelectedCollection(data.collections[0]._id);
      }
    } catch (err) {
      console.error('Failed to fetch collections');
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    try {
      const { data } = await api.post('/api/collection', {
        name: newCollectionName,
        projectId: currentProject._id,
        teamId: currentProject.teamId
      });
      setCollections([...collections, data.collection]);
      setSelectedCollection(data.collection._id);
      setIsCreatingCollection(false);
      setNewCollectionName('');
      toast.success('Collection created!');
    } catch (err) {
      toast.error('Failed to create collection');
    }
  };

  const toggleRoute = (id) => {
    if (selectedRoutes.includes(id)) {
      setSelectedRoutes(selectedRoutes.filter(r => r !== id));
    } else {
      setSelectedRoutes([...selectedRoutes, id]);
    }
  };

  const handleSync = async () => {
    if (!selectedCollection) {
      toast.error('Please select or create a collection');
      return;
    }

    setIsSyncing(true);
    const routesToSync = diff.newRoutes.filter(r => selectedRoutes.includes(r.path + r.method));
    
    try {
      // Pass the selected routes and the target collection to the parent
      await onSync(routesToSync, selectedCollection);
      onClose();
    } catch (err) {
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!diff) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] bg-surface-1 border-l border-[var(--border-2)] shadow-2xl z-[1000] flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-2)] flex items-center justify-between bg-surface-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Zap size={18} className="text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-tx-primary">AST Sync Review</h2>
            <p className="text-[10px] text-surface-400">Detected {diff.newRoutes.length} new endpoints</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-surface-3 rounded-md text-surface-400">
          <X size={18} />
        </button>
      </div>

      {/* Collection Assignment */}
      <div className="p-4 bg-surface-2/50 border-b border-[var(--border-2)]">
        <label className="text-[10px] font-bold text-surface-400 uppercase mb-2 block">Target Collection</label>
        
        {!isCreatingCollection ? (
          <div className="flex gap-2">
            <select 
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="flex-1 bg-surface-1 border border-[var(--border-2)] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-accent outline-none"
            >
              <option value="">Select a collection...</option>
              {collections.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            <button 
              onClick={() => setIsCreatingCollection(true)}
              className="p-2 bg-surface-3 hover:bg-surface-4 rounded-md text-surface-400"
              title="Create new collection"
            >
              <Plus size={16} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2 animate-in fade-in zoom-in-95 duration-200">
            <input 
              autoFocus
              className="flex-1 bg-surface-1 border border-[var(--border-2)] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-accent outline-none"
              placeholder="Collection name..."
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateCollection()}
            />
            <button onClick={handleCreateCollection} className="p-2 bg-accent text-white rounded-md">
              <Check size={16} />
            </button>
            <button onClick={() => setIsCreatingCollection(false)} className="p-2 bg-surface-3 rounded-md text-surface-400">
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Route List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-surface-400 uppercase">New Endpoints</span>
          <button 
            onClick={() => setSelectedRoutes(selectedRoutes.length === diff.newRoutes.length ? [] : diff.newRoutes.map(r => r.path + r.method))}
            className="text-[10px] text-accent hover:underline"
          >
            {selectedRoutes.length === diff.newRoutes.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {diff.newRoutes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertCircle size={32} className="text-surface-300 mb-2" />
            <p className="text-xs text-surface-400">No new routes detected.</p>
          </div>
        )}

        {diff.newRoutes.map((route, idx) => {
          const id = route.path + route.method;
          const isSelected = selectedRoutes.includes(id);
          const color = route.method === 'GET' ? '#3FB950' : route.method === 'POST' ? '#58A6FF' : route.method === 'PUT' ? '#E3B341' : route.method === 'DELETE' ? '#F85149' : '#A8A8A8';

          return (
            <div 
              key={idx}
              onClick={() => toggleRoute(id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                isSelected 
                  ? 'bg-accent/5 border-accent/30 ring-1 ring-accent/20' 
                  : 'bg-surface-2 border-[var(--border-2)] hover:border-surface-400'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  isSelected ? 'bg-accent border-accent text-white' : 'border-[var(--border-2)] bg-surface-1'
                }`}>
                  {isSelected && <Check size={12} strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase" style={{ color, background: `${color}15` }}>
                      {route.method}
                    </span>
                    <span className="text-[11px] font-mono text-tx-primary truncate">{route.path}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-surface-400 truncate">Handler: {route.handler}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border-2)] bg-surface-2 flex flex-col gap-2">
        <button 
          disabled={selectedRoutes.length === 0 || isSyncing}
          onClick={handleSync}
          className="w-full py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-accent/20 transition-all"
        >
          {isSyncing ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Zap size={14} />
          )}
          Keep {selectedRoutes.length} Endpoints
        </button>
        <p className="text-[9px] text-center text-surface-400">
          Selected APIs will be added to "{collections.find(c => c._id === selectedCollection)?.name || '...'}"
        </p>
      </div>
    </div>
  );
}
