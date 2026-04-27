import { useEffect, useState } from 'react';
import PayloadX from '@/components/core/logo';
import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useRequestStore } from '@/store/requestStore';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { getMethodClass, truncate } from '@/utils/helpers';
import toast from 'react-hot-toast';
import { save } from '@tauri-apps/api/dialog';
import { writeTextFile } from '@tauri-apps/api/fs';
import { exportToPostman } from '@/utils/postmanExporter';

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { teams, currentTeam, fetchTeams, setCurrentTeam } = useTeamStore();
  const { projects, currentProject, fetchProjects, setCurrentProject, getFilteredProjects } = useProjectStore();
  const { collections, currentCollection, fetchCollections, fetchCollectionRequests, loadCollectionRequestsFromStorage, requests, getFilteredCollections } = useCollectionStore();
  const { setCurrentRequest } = useRequestStore();
  const { disconnect } = useSocketStore();
  const {
    setShowTeamModal,
    setShowProjectModal,
    setShowCollectionModal,
    setShowFolderModal,
    setShowImportModal,
    setShowEnvironmentPanel,
    setShowInviteModal,
    theme,
    toggleTheme,
    toggleLayout,
    setContextMenu,
  } = useUIStore();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [expandedCollections, setExpandedCollections] = useState(() => {
    const saved = localStorage.getItem('sidebar_expanded_collections');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [initializedCollections, setInitializedCollections] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered data based on current selection
  const filteredProjects = currentTeam ? getFilteredProjects(currentTeam._id) : [];
  const filteredCollections = currentProject ? getFilteredCollections(currentProject._id) : [];

  const handleLogout = () => {
    disconnect();
    logout();
    toast.success('Signed out successfully');
  };

  // Initial load
  useEffect(() => { fetchTeams(); }, []);
  useEffect(() => { if (currentTeam) fetchProjects(currentTeam._id); }, [currentTeam]);
  useEffect(() => { if (currentProject) fetchCollections(currentProject._id); }, [currentProject]);

  // Load cached requests for expanded collections on mount
  useEffect(() => {
    expandedCollections.forEach(id => {
      loadCollectionRequestsFromStorage(id);
      setInitializedCollections(prev => new Set(prev).add(id));
    });
  }, []);

  const toggleCollection = async (col) => {
    const id = col._id;
    if (expandedCollections.has(id)) {
      const next = new Set(expandedCollections);
      next.delete(id);
      setExpandedCollections(next);
      localStorage.setItem('sidebar_expanded_collections', JSON.stringify([...next]));
    } else {
      const next = new Set([...expandedCollections, id]);
      setExpandedCollections(next);
      localStorage.setItem('sidebar_expanded_collections', JSON.stringify([...next]));
      // Load from cache first, fetch from API only if not initialized
      if (!initializedCollections.has(id)) {
        setInitializedCollections(prev => new Set(prev).add(id));
        await fetchCollectionRequests(id);
      }
      setCurrentCollection(col);
    }
  };

  const toggleFolder = (folderId) => {
    const next = new Set(expandedFolders);
    if (next.has(folderId)) {
      next.delete(folderId);
      if (currentFolderId === folderId) setCurrentFolderId(null);
    } else {
      next.add(folderId);
      setCurrentFolderId(folderId);
    }
    setExpandedFolders(next);
  };

  const handleQuickCreateRequest = async (collectionId, folderId = null) => {
    const { useRequestStore } = await import('@/store/requestStore');

    if (!currentProject || !currentTeam) {
      toast.error('Select a project and team first');
      return;
    }

    const name = 'New Request';
    const result = await useRequestStore.getState().createRequest({
      name,
      method: 'GET',
      protocol: 'http',
      url: '',
      collectionId,
      projectId: currentProject._id,
      teamId: currentTeam._id,
      folderId
    });

    if (result.success) {
      setCurrentRequest(result.request);
      // Auto expand collection/folder
      if (!expandedCollections.has(collectionId)) {
        const next = new Set(expandedCollections);
        next.add(collectionId);
        setExpandedCollections(next);
      }
      if (folderId && !expandedFolders.has(folderId)) {
        const next = new Set(expandedFolders);
        next.add(folderId);
        setExpandedFolders(next);
      }
    }
  };

  const handleExportCollection = async (e, col) => {
    if (e) e.stopPropagation(); // Prevent toggling the collection

    const toastId = toast.loading(`Preparing ${col.name} for export...`);
    try {
      // 1. Ensure we have all requests for this collection
      // If not initialized, fetch them first
      if (!initializedCollections.has(col._id)) {
        setInitializedCollections(prev => new Set(prev).add(col._id));
        await fetchCollectionRequests(col._id);
      }

      // 2. Filter requests belonging to this collection
      const colRequests = filteredRequests(col._id);

      // 3. Convert to Postman format
      const postmanData = exportToPostman(col, colRequests);
      const jsonString = JSON.stringify(postmanData, null, 2);

      // 4. Save file using Tauri dialog
      const filePath = await save({
        filters: [{ name: 'Postman Collection', extensions: ['json'] }],
        defaultPath: `${col.name.replace(/[^a-z0-9]/gi, '_')}.postman_collection.json`,
      });

      if (filePath) {
        await writeTextFile(filePath, jsonString);
        toast.success(`${col.name} exported successfully`, { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export collection', { id: toastId });
    }
  };

  const showCollectionContextMenu = (e, col) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          id: 'add-folder',
          label: 'New Folder',
          icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>,
          onClick: () => setShowFolderModal(true, { collectionId: col._id })
        },
        {
          id: 'add-request',
          label: 'New Request',
          icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
          onClick: () => handleQuickCreateRequest(col._id)
        },
        { type: 'separator' },
        {
          id: 'export',
          label: 'Export as Postman',
          icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
          onClick: () => handleExportCollection(null, col)
        }
      ]
    });
  };

  const showFolderContextMenu = (e, colId, folder) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          id: 'add-request',
          label: 'New Request',
          icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
          onClick: () => handleQuickCreateRequest(colId, folder.id)
        },
        {
          id: 'add-subfolder',
          label: 'New Subfolder',
          icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>,
          onClick: () => setShowFolderModal(true, { collectionId: colId, parentId: folder.id })
        },
        {
          id: 'rename',
          label: 'Rename',
          icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
          onClick: () => setShowFolderModal(true, { collectionId: colId, folderId: folder.id, name: folder.name })
        },
        {
          id: 'delete',
          label: 'Delete',
          icon: <svg className="w-3.5 h-3.5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
          onClick: () => {
            const { deleteFolder } = useCollectionStore.getState();
            if (confirm(`Delete folder "${folder.name}"? Requests will be moved to collection root.`)) {
              deleteFolder(colId, folder.id);
            }
          }
        }
      ]
    });
  };

  const filteredRequests = (collectionId) =>
    requests.filter(
      (r) =>
        r.collectionId === collectionId &&
        (searchQuery
          ? r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.url.toLowerCase().includes(searchQuery.toLowerCase())
          : true)
    );

  return (
    <aside
      className="flex flex-col h-full border-r border-[var(--border-1)] select-none"
      style={{ background: 'var(--bg-secondary)' }}
    >
      {/* Header */}
      <div className="p-3 border-b border-[var(--border-1)]">
        <div className="flex items-center gap-2 mb-3">
          <PayloadX className="w-7 h-7" fontSize="10px" />
          <span className="text-sm font-semibold text-tx-primary"><span className="metallic-app-name text-base">PayloadX</span> Studio</span>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search requests..."
            className="input pl-8 py-1.5 text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Team selector */}
      <div className="p-2 border-b border-[var(--border-1)]">
        <div className="flex items-center justify-between mb-1 px-1">
          <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Team</span>
          <button
            onClick={() => setShowTeamModal(true)}
            className="transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="New team"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
          {teams.map((team) => {
            const isActive = currentTeam?._id === team._id;
            return (
              <button
                key={team._id}
                onClick={() => setCurrentTeam(team)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all w-full"
                style={isActive
                  ? { background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border-2)' }
                  : { color: 'var(--text-secondary)', border: '1px solid transparent' }
                }
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
              >
                <div
                  className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                  style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border-1)' }}
                >
                  {team.name[0].toUpperCase()}
                </div>
                <span className="truncate flex-1">{team.name}</span>
                {team.members?.length > 0 && (
                  <span
                    className="text-[9px] px-1 rounded-full flex-shrink-0"
                    style={{ color: 'var(--text-muted)', background: 'var(--surface-3)' }}
                  >
                    {team.members.length + 1}
                  </span>
                )}
              </button>
            );
          })}
          {teams.length === 0 && (
            <p className="text-tx-muted text-xs px-2 py-1">No teams yet</p>
          )}
        </div>
      </div>

      {/* Projects */}
      {currentTeam && (
        <div className="p-2 border-b border-[var(--border-1)]">
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Projects</span>
            <button onClick={() => setShowProjectModal(true)} className="text-surface-500 hover:text-brand-400 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
          <div className="flex flex-col gap-0.5">
            {filteredProjects.map((project) => (
              <button
                key={project._id}
                onClick={() => setCurrentProject(project)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all w-full text-left ${currentProject?._id === project._id
                    ? 'bg-surface-700 text-tx-primary'
                    : 'text-surface-400 hover:text-tx-primary hover:bg-surface-800'
                  }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: project.color || '#6366f1' }}
                />
                <span className="truncate">{project.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Collections */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Collections</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowImportModal(true)} className="text-surface-500 hover:text-warning transition-colors" title="Import Postman collection">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              </button>
              <button onClick={() => setShowCollectionModal(true)} className="text-surface-500 hover:text-brand-400 transition-colors" title="New collection">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            {filteredCollections.map((col) => {
              const isExpanded = expandedCollections.has(col._id);
              const colRequests = filteredRequests(col._id);

              return (
                <div key={col._id}>
                  <button
                    onClick={() => toggleCollection(col)}
                    onContextMenu={(e) => showCollectionContextMenu(e, col)}
                    className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all w-full text-left ${currentCollection?._id === col._id
                        ? 'bg-surface-750 text-tx-primary'
                        : 'text-surface-400 hover:text-tx-primary hover:bg-surface-800'
                      }`}
                  >
                    <svg
                      className={`w-3 h-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="truncate flex-1">{col.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-50 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowFolderModal(true, { collectionId: col._id }); }}
                        className="p-1 hover:text-tx-primary hover:opacity-100 hover:bg-surface-3 rounded transition-all"
                        title="New Folder"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleQuickCreateRequest(col._id); }}
                        className="p-1 hover:text-tx-primary hover:bg-surface-3 rounded transition-colors"
                        title="New Request"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleExportCollection(e, col)}
                        className="p-1 hover:text-tx-primary hover:bg-surface-3 rounded transition-colors"
                        title="Export as Postman JSON"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </button>
                      {col.isImported && (
                        <span className="text-[9px] bg-warning/20 text-warning px-1 py-0.5 rounded">Postman</span>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="ml-3 pl-2 border-l border-[var(--border-1)] mt-0.5 flex flex-col gap-0.5 animate-in">
                      {/* Folders */}
                      {(() => {
                        const renderRecursiveFolders = (parentId = null, depth = 0) => {
                          const levelFolders = (col.folders || []).filter(f => (f.parentId || null) === parentId);
                          return levelFolders.map(folder => {
                            const folderReqs = colRequests.filter((r) => r.folderId === folder.id);
                            const isFolderExpanded = expandedFolders.has(folder.id);
                            return (
                              <div key={folder.id} className={depth > 0 ? 'ml-3 border-l border-white/5 pl-1' : ''}>
                                <button
                                  onClick={() => toggleFolder(folder.id)}
                                  onContextMenu={(e) => showFolderContextMenu(e, col._id, folder)}
                                  className="group flex items-center gap-1.5 px-2 py-1 rounded text-xs text-surface-400 hover:text-tx-primary hover:bg-surface-800 w-full text-left"
                                >
                                  <svg className={`w-2.5 h-2.5 flex-shrink-0 transition-transform ${isFolderExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                  <svg className="w-3 h-3 text-warning flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                  </svg>
                                  <span className="truncate">{folder.name}</span>
                                  <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-50 transition-opacity">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleQuickCreateRequest(col._id, folder.id); }}
                                      className="p-0.5 hover:text-tx-primary hover:opacity-100 hover:bg-surface-3 rounded transition-all"
                                      title="New Request"
                                    >
                                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      </svg>
                                    </button>
                                  </div>
                                </button>
                                {isFolderExpanded && (
                                  <>
                                    {renderRecursiveFolders(folder.id, depth + 1)}
                                    {folderReqs.map(req => (
                                      <RequestItem key={req._id} request={req} onSelect={setCurrentRequest} />
                                    ))}
                                  </>
                                )}
                              </div>
                            );
                          });
                        };
                        return renderRecursiveFolders(null, 0);
                      })()}

                      {/* Root-level requests */}
                      {colRequests.filter((r) => !r.folderId).map((req) => (
                        <RequestItem key={req._id} request={req} onSelect={setCurrentRequest} />
                      ))}

                      {colRequests.length === 0 && (
                        <p className="text-tx-muted text-xs px-2 py-1 italic">No requests</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-2 border-t border-[var(--border-1)] flex flex-col gap-0.5">
        <button
          onClick={() => setShowEnvironmentPanel(true)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-surface-400 hover:text-tx-primary hover:bg-surface-800 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          Environments
        </button>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--surface-3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = ''; }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
          Team Members
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--surface-3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = ''; }}
        >
          {theme === 'dark' ? (
            /* Sun icon — click to go light */
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.66-10h-1M4.34 12H3m15.07-6.07l-.71.71M6.64 17.36l-.71.71M17.36 17.36l.71.71M6.64 6.64l.71-.71M12 8a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
          ) : (
            /* Moon icon — click to go dark */
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        {/* Layout toggle — switch to V2 */}
        <button
          onClick={toggleLayout}
          title="Switch to New Layout (V2)"
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--surface-3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = ''; }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
          New UI ✦
        </button>

        {/* Creator Note */}
        <div className="px-2 py-1.5 mt-1 border-t border-[var(--border-1)] opacity-40">
          <p className="text-[10px] text-surface-500 font-medium">
            Project by <span className="text-tx-secondary">Sundan Sharma</span>
          </p>
        </div>

        {/* User card with logout */}
        <div className="relative mt-1">
          <button
            onClick={() => setShowLogoutConfirm((v) => !v)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-surface-400 hover:text-tx-primary hover:bg-surface-800 transition-all w-full"
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
              style={{ background: 'var(--surface-3)', color: 'var(--text-primary)', border: '1px solid var(--border-2)' }}
            >
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs text-tx-primary truncate leading-tight">{user?.name}</p>
              <p className="text-[10px] text-surface-500 truncate leading-tight">{user?.email}</p>
            </div>
            <svg className={`w-3 h-3 flex-shrink-0 transition-transform ${showLogoutConfirm ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Logout dropdown */}
          {showLogoutConfirm && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface-850 border border-[var(--border-1)] rounded-xl shadow-glass overflow-hidden animate-in">
              <div className="px-3 py-2 border-b border-[var(--border-1)]">
                <p className="text-[10px] text-surface-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-danger hover:bg-danger/10 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function RequestItem({ request, onSelect }) {
  return (
    <button
      onClick={() => onSelect(request)}
      className="flex items-center gap-2 px-2 py-1 rounded text-xs text-surface-400 hover:text-tx-primary hover:bg-surface-800 transition-all w-full text-left group"
    >
      <span className={`${getMethodClass(request.method)} flex-shrink-0 text-[9px]`}>
        {request.method}
      </span>
      <span className="truncate group-hover:text-tx-primary transition-colors">{request.name}</span>
    </button>
  );
}
