import { useEffect, useState } from 'react';
import { useApiDocStore } from '@/store/apiDocStore';
import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';
import { useSocketStore } from '@/store/socketStore';
import CreateDocModal from './CreateDocModal';
import EndpointEditor from './EndpointEditor';
import { formatTime } from '@/utils/helpers';
import toast from 'react-hot-toast';

const METHOD_COLORS = {
  GET: '#3FB950', POST: '#58A6FF', PUT: '#E3B341', PATCH: '#A8A8A8',
  DELETE: '#F85149', HEAD: '#5A5A5A', OPTIONS: '#39C5CF',
};

const genId = () => Math.random().toString(36).substr(2, 9);

export default function ApiDocsPanel() {
  const { currentTeam } = useTeamStore();
  const { currentProject } = useProjectStore();
  const { socket, apiDocViewers } = useSocketStore();
  
  const { 
    docs, fetchDocs, 
    currentDoc, fetchDocDetail, deleteDoc, setCurrentDoc,
    currentEndpoint, setCurrentEndpoint, addEndpoint 
  } = useApiDocStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeMembers, setActiveMembers] = useState({}); // { endpointId: [userIds] }

  // Load docs on mount or project change
  useEffect(() => {
    if (currentProject) fetchDocs(currentProject._id);
  }, [currentProject]);

  // Load doc details initially if none loaded but one is clicked
  const handleSelectDoc = (doc) => {
    setCurrentDoc(doc);
    fetchDocDetail(doc._id);
    setCurrentEndpoint(null);
  };

  // Handle Socket Events for Live Collaboration
  useEffect(() => {
    if (!socket) return;

    const onDocUpdated = ({ doc }) => {
      // If the incoming doc is the one we are viewing, update local state
      // useApiDocStore handles the lists automatically if we call a setter,
      // but the cleaner way is to let the store handle it if we hooked it.
      // For immediate patching matching ID, we can do a local sync.
      if (currentDoc && currentDoc._id === doc._id) {
        // Find if current endpoint was deleted
        if (currentEndpoint) {
          const exists = doc.endpoints.find(e => e.id === currentEndpoint.id);
          if (!exists) setCurrentEndpoint(null);
          else {
            // Check if another user edited our active endpoint heavily
            // Normally we'd do smart merging. Here we overwrite if it's external update.
            // *Implementation choice*: avoid overwriting if WE are the ones editing.
          }
        }
        setCurrentDoc(doc);
        toast(`Doc "${doc.name}" updated by a team member`, { icon: '🔄', id: 'doc-update' });
      }
      
      // Refresh list
      if (currentProject) fetchDocs(currentProject._id);
    };

    const onTypingStart = ({ docId, endpointId, userId }) => {
      if (currentDoc?._id === docId) {
        setActiveMembers(prev => {
          const ex = prev[endpointId] || [];
          if (!ex.includes(userId)) {
             // Set a safety timeout to clear if stop event is missed
             setTimeout(() => onTypingStop({ docId, endpointId, userId }), 5000);
             return { ...prev, [endpointId]: [...ex, userId] };
          }
          return prev;
        });
      }
    };

    const onTypingStop = ({ docId, endpointId, userId }) => {
      setActiveMembers(prev => {
        const ex = prev[endpointId] || [];
        if (!ex.includes(userId)) return prev;
        return { ...prev, [endpointId]: ex.filter(id => id !== userId) };
      });
    };

    socket.on('apidoc_updated', onDocUpdated);
    socket.on('apidoc_user_typing', onTypingStart);
    socket.on('apidoc_user_stopped_typing', onTypingStop);

    return () => {
      socket.off('apidoc_updated', onDocUpdated);
      socket.off('apidoc_user_typing', onTypingStart);
      socket.off('apidoc_user_stopped_typing', onTypingStop);
    };
  }, [socket, currentDoc, currentProject, currentEndpoint]);

  const handleCreateEndpoint = () => {
    if (!currentDoc) return;
    const newEp = {
      id: genId(),
      path: '/new-endpoint',
      method: 'GET',
      summary: 'New API Endpoint',
      description: '',
      queryParams: [],
      headers: [],
      requestBody: { schema: '{}', contentType: 'application/json' },
      responses: [{ id: genId(), statusCode: 200, description: 'Success', schema: '{}' }]
    };
    addEndpoint(currentDoc._id, newEp);
    setCurrentEndpoint(newEp);
  };

  const handleExport = (e, doc) => {
    e.stopPropagation();
    window.open(`http://localhost:4000/api/apidoc/${doc._id}/export`, '_blank');
  };

  const handleDeleteDoc = (e, doc) => {
    e.stopPropagation();
    if (confirm(`Delete API Documentation "${doc.name}"?`)) {
      deleteDoc(doc._id);
    }
  };

  if (!currentTeam || !currentProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-surface-500 text-sm">
        <svg className="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p>Select a team and project to view API documentation.</p>
      </div>
    );
  }

  return (
    <div className="flex w-full h-full bg-[var(--v2-workspace-bg)] overflow-hidden">
      
      {/* ── LEFT PANEL: Document List ── */}
      <div className="w-[280px] flex-shrink-0 flex flex-col border-r border-[var(--border-1)] bg-surface-1">
        <div className="px-4 py-3 border-b border-[var(--border-1)] flex items-center justify-between bg-surface-2">
          <h2 className="text-xs font-semibold text-tx-primary uppercase tracking-tight">API Documentations</h2>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="p-1 rounded text-surface-400 hover:text-tx-primary hover:bg-surface-3 transition-colors"
            title="Create completely new API Documentation"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 4v16m8-8H4"/></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {docs.length === 0 ? (
             <div className="mt-8 text-center px-4">
                <p className="text-xs text-surface-500 mb-4">No documentation exists for this project.</p>
                <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-medium w-full transition-all">
                  Create API Doc
                </button>
             </div>
          ) : (
            docs.map(doc => {
              const isActive = currentDoc?._id === doc._id;
              return (
                <div 
                  key={doc._id}
                  onClick={() => handleSelectDoc(doc)}
                  className={`flex flex-col gap-1 p-2.5 rounded-lg cursor-pointer transition-colors group border border-transparent ${
                    isActive ? 'bg-surface-3 border-[var(--border-1)]' : 'hover:bg-surface-2'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[13px] font-medium text-tx-primary truncate pr-2">{doc.name}</span>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => handleExport(e, doc)} title="Export OpenAPI 3.0" className="p-1 text-surface-400 hover:text-accent rounded"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></button>
                      <button onClick={(e) => handleDeleteDoc(e, doc)} title="Delete Doc" className="p-1 text-surface-400 hover:text-error rounded ml-1"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
                    </div>
                  </div>
                  <div className="flex items-center text-[10px] text-surface-400 gap-2">
                    <span className="bg-surface-4 px-1.5 py-0.5 rounded text-tx-secondary font-mono">v{doc.version}</span>
                    <span className="truncate">{doc.baseUrl || 'No base URL'}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── MIDDLE PANEL: Endpoint List ── */}
      {currentDoc ? (
        <div className="w-[300px] flex-shrink-0 flex flex-col border-r border-[var(--border-1)] bg-surface-1">
          <div className="px-4 py-3 border-b border-[var(--border-1)] flex flex-col gap-1.5 bg-surface-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-tx-primary truncate pr-2">{currentDoc.name}</h3>
              <button onClick={handleCreateEndpoint} title="Add Endpoint" className="text-xs bg-surface-3 hover:bg-surface-4 text-tx-primary px-2 py-0.5 rounded border border-[var(--border-1)] flex items-center gap-1 transition-colors">
                 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 4v16m8-8H4"/></svg> Add
              </button>
            </div>
            <div className="text-[10px] text-surface-400 flex items-center gap-1.5 opacity-80">
               <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse"></span>
               Real-time sync on
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
            {!currentDoc.endpoints || currentDoc.endpoints.length === 0 ? (
               <div className="p-4 text-center text-xs text-surface-500 italic mt-4">
                 No endpoints. Click Add to create one.
               </div>
            ) : (
               currentDoc.endpoints.map(ep => {
                 const isActive = currentEndpoint?.id === ep.id;
                 const color = METHOD_COLORS[ep.method] || '#9A9A9A';
                 const isBeingEdited = (activeMembers[ep.id]?.length || 0) > 0;

                 return (
                   <button 
                     key={ep.id}
                     onClick={() => setCurrentEndpoint(ep)}
                     className={`w-full text-left flex flex-col gap-1 px-3 py-2 rounded-lg cursor-pointer transition-colors border border-transparent group ${
                       isActive ? 'bg-surface-3 border-[var(--border-1)]' : 'hover:bg-surface-2'
                     }`}
                   >
                     <div className="flex items-center justify-between w-full">
                       <div className="flex items-center gap-2 overflow-hidden flex-1">
                         <span style={{ color, background: `${color}18` }} className="text-[9px] font-bold px-[5px] py-0.5 rounded min-w-[36px] text-center flex-shrink-0">
                           {ep.method}
                         </span>
                         <span className={`text-[12px] truncate ${isActive ? 'text-tx-primary' : 'text-tx-muted'}`}>
                           {ep.path}
                         </span>
                       </div>
                       <div className="flex items-center gap-1.5 ml-2">
                          {isBeingEdited && !isActive && (
                            <span className="w-1.5 h-1.5 bg-warning rounded-full flex-shrink-0 animate-pulse" title="Someone is editing"></span>
                          )}
                          {(apiDocViewers[ep.id]?.length > 0) && !isActive && (
                             <div className="flex -space-x-1 items-center">
                                {apiDocViewers[ep.id].slice(0, 2).map((v, idx) => (
                                   <div key={idx} className="w-3.5 h-3.5 rounded-full border border-surface-1 flex items-center justify-center text-[6px] font-bold text-white shadow-sm" style={{ backgroundColor: `hsl(${(v.name?.length || 0) * 40}, 60%, 50%)` }}>
                                      {v.name?.[0]?.toUpperCase() || '?'}
                                   </div>
                                ))}
                                {apiDocViewers[ep.id].length > 2 && (
                                   <div className="w-3.5 h-3.5 rounded-full bg-surface-3 border border-surface-1 flex items-center justify-center text-[5px] font-bold text-surface-500">
                                      +{apiDocViewers[ep.id].length - 2}
                                   </div>
                                )}
                             </div>
                          )}
                       </div>
                     </div>
                     {ep.summary && (
                       <div className="text-[10px] text-surface-400 truncate w-full pl-[44px]">
                         {ep.summary}
                       </div>
                   )}
                   </button>
                 );
               })
            )}
          </div>
        </div>
      ) : (
        <div className="w-[300px] flex-shrink-0 flex items-center justify-center border-r border-[var(--border-1)] bg-surface-1">
          <p className="text-xs text-surface-500 px-6 text-center leading-relaxed">Select a document from the left to view its endpoints.</p>
        </div>
      )}

      {/* ── RIGHT PANEL: Editor ── */}
      <div className="flex-1 flex flex-col bg-[var(--v2-workspace-bg)] overflow-hidden">
        {currentDoc && currentEndpoint ? (
          <EndpointEditor endpoint={currentEndpoint} docId={currentDoc._id} />
        ) : (
          <div className="m-auto flex flex-col items-center max-w-[300px] text-center gap-3">
             <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-[var(--border-1)] flex items-center justify-center text-tx-secondary shadow-sm">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
             </div>
             <p className="text-sm font-medium text-tx-secondary">Interactive API Editor</p>
             <p className="text-xs text-surface-400">Select an endpoint from the middle panel or create a new one to start documenting.</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && <CreateDocModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
}
