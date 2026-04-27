import { useState, useEffect, useRef, useMemo } from 'react';
import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useRequestStore } from '@/store/requestStore';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';
import { useWorkflowStore } from '@/store/workflowStore';
import RefreshButton from '@/components/RefreshButton/RefreshButton';
import PayloadX from '@/components/core/logo';
import { localStorageService } from '@/services/localStorageService';

const NAV_ITEMS = [
  {
    id: 'collections',
    label: 'Collections',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: 'workflow',
    label: 'Workflow',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
      </svg>
    ),
  },
  {
    id: 'environments',
    label: 'Env',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
  {
    id: 'docs',
    label: 'Docs',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

const METHOD_COLORS = {
  GET: '#3FB950',
  POST: '#58A6FF',
  PUT: '#E3B341',
  PATCH: '#A8A8A8',
  DELETE: '#F85149',
  HEAD: '#5A5A5A',
  OPTIONS: '#39C5CF',
};

export default function SidebarV2({
  onShowTeamModal,
  onShowProjectModal,
  onShowCollectionModal,
  onShowImportModal,
  onOpenEnvPanel,
  width,
}) {
  const [refreshingColId, setRefreshingColId] = useState(null);
  const { user, logout } = useAuthStore();
  const {
    teams,
    currentTeam,
    fetchTeams,
    setCurrentTeam,
    updateTeamName,
    deleteTeam,
    isLoading: isLoadingTeams,
    isRefreshing: isRefreshingTeams,
    refreshTeams
  } = useTeamStore();
  const {
    projects,
    currentProject,
    fetchProjects,
    setCurrentProject,
    updateProjectName,
    deleteProject,
    isLoading: isLoadingProjects,
    isRefreshing: isRefreshingProjects,
    refreshProjects,
    getFilteredProjects,
    isLoading: isCreatingProject,
    isDeleting: isDeletingProject
  } = useProjectStore();
  const {
    collections,
    currentCollection,
    fetchCollections,
    fetchCollectionRequests,
    requests,
    updateCollectionName,
    deleteCollection,
    addRequest,
    isLoading: isLoadingCollections,
    loadingCollections,
    isLoadingRequests,
    isRefreshing: isRefreshingCollections,
    refreshCollections,
    refreshCollectionRequests,
    loadCollectionRequestsFromStorage,
    getFilteredCollections,
    setCurrentCollection,
    isCreating: isCreatingCollection,
    isDeleting: isDeletingCollection
  } = useCollectionStore();

  const {
    workflows,
    currentWorkflow,
    openWorkflow,
    fetchWorkflows,
    newWorkflow,
    saveWorkflow,
    deleteWorkflow,
    updateWorkflowField,
    isCreating: isCreatingWorkflow,
    isDeleting: isDeletingWorkflow
  } = useWorkflowStore();

  const { disconnect } = useSocketStore();
  const { isConnected } = useSocketStore();
  const {
    theme,
    toggleTheme,
    toggleLayout,
    activeV2Nav,
    setActiveV2Nav,
    setContextMenu,
    setShowConfirmDialog,
    setShowEditNameModal,
    setShowInviteModal
  } = useUIStore();
  const { 
    currentRequest, 
    setCurrentRequest, 
    createRequest, 
    updateRequestName, 
    deleteRequest, 
    setNoActiveRequest,
    isCreating: isCreatingRequest,
    isDeleting: isDeletingRequest
  } = useRequestStore();

  const handleRequestSelect = (request) => {
    setCurrentRequest(request);
    if (activeV2Nav !== 'collections') {
      setActiveV2Nav('collections');
    }
  };



  const [expandedCollections, setExpandedCollections] = useState(() => {
    const saved = localStorage.getItem('sidebar_expanded_collections');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const expandedCollectionsRef = useRef(expandedCollections);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const logoutMenuRef = useRef(null);
  const [initializedCollections, setInitializedCollections] = useState(new Set());

  const [expandedProjects, setExpandedProjects] = useState(() => {
    const saved = localStorage.getItem('sidebar_expanded_projects');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // ── Workflow inline-rename state ──────────────────────────────
  const [renamingWorkflowId, setRenamingWorkflowId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef(null);

  const startRename = (wf, e) => {
    e.stopPropagation();
    setRenamingWorkflowId(wf.id);
    setRenameValue(wf.name || 'Untitled Workflow');
    setTimeout(() => renameInputRef.current?.select(), 30);
  };

  const commitRename = async (wf) => {
    const trimmed = renameValue.trim();
    setRenamingWorkflowId(null);
    if (!trimmed || trimmed === wf.name) return;
    // If it's the currently open workflow, update via store field
    if (currentWorkflow?.id === wf.id) {
      updateWorkflowField('name', trimmed);
      await saveWorkflow();
    } else {
      // Update in workflows list optimistically then save via API
      const updated = { ...wf, name: trimmed };
      openWorkflow(updated);
      await saveWorkflow();
      // Re-fetch to sync list
      if (currentTeam) fetchWorkflows(currentTeam._id, currentProject?._id);
    }
    toast.success('Workflow renamed');
  };

  const handleDeleteWorkflow = async (wf, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${wf.name || 'Untitled Workflow'}"? This cannot be undone.`)) return;
    await deleteWorkflow(wf.id);
    // If we deleted the active workflow, clear canvas
    if (currentWorkflow?.id === wf.id) {
      await newWorkflow(currentTeam?._id, currentProject?._id);
    }
  };

  const handleCreateWorkflow = async () => {
    const wf = await newWorkflow(currentTeam?._id, currentProject?._id);
    if (wf) {
      toast.success('New workflow created — drag APIs onto the canvas');
    }
  };

  // Load section expansion state from localStorage
  const [showTeamsSection, setShowTeamsSection] = useState(() => {
    const saved = localStorage.getItem('sidebar_teams_expanded');
    return saved !== null ? saved === 'true' : true;
  });
  const [showProjectsSection, setShowProjectsSection] = useState(() => {
    const saved = localStorage.getItem('sidebar_projects_expanded');
    return saved !== null ? saved === 'true' : true;
  });
  const [showCollectionsSection, setShowCollectionsSection] = useState(() => {
    const saved = localStorage.getItem('sidebar_collections_expanded');
    return saved !== null ? saved === 'true' : true;
  });

  // Persist section expansion state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar_collections_expanded', showCollectionsSection);
  }, [showCollectionsSection]);
  useEffect(() => {
    localStorage.setItem('sidebar_teams_expanded', showTeamsSection);
  }, [showTeamsSection]);

  useEffect(() => {
    localStorage.setItem('sidebar_projects_expanded', showProjectsSection);
  }, [showProjectsSection]);

  // Filtered data based on current selection
  const filteredProjects = useMemo(() => {
    if (!currentTeam) return [];
    const all = getFilteredProjects(currentTeam._id);
    if (currentProject) {
      return all.filter(p => p._id === currentProject._id);
    }
    return all;
  }, [currentTeam?._id, currentProject?._id, projects]);

  const filteredCollections = useMemo(() =>
    currentProject ? getFilteredCollections(currentProject._id) : [],
    [currentProject?._id, collections]
  );

  // ── Data fetching ──────────────────
  useEffect(() => { fetchTeams(); }, []);
  useEffect(() => { if (currentTeam) fetchProjects(currentTeam._id); }, [currentTeam?._id]);

  // Auto-Sync everything if collections is empty or on team change
  useEffect(() => {
    if (currentTeam && collections.length === 0) {
      syncAll(currentTeam._id);
    }
  }, [currentTeam?._id]);

  // Use a derived state for grouped collections to avoid recalculating during render
  const collectionsByProject = useMemo(() => {
    return collections.reduce((acc, col) => {
      const pid = col.projectId;
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push(col);
      return acc;
    }, {});
  }, [collections]);

  const { syncAll } = useCollectionStore();

  // ── Update ref when expandedCollections changes ──────────────────
  useEffect(() => {
    expandedCollectionsRef.current = expandedCollections;
  }, [expandedCollections]);

  // ── Listen for storage events to sync expanded collections ──────────────────
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('sidebar_expanded_collections');
      if (saved) {
        const expandedIds = JSON.parse(saved);
        setExpandedCollections(new Set(expandedIds));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ── Close logout menu when clicking outside ──────────────────
  useEffect(() => {
    if (!showLogout) return;

    const handleClickOutside = (e) => {
      if (logoutMenuRef.current && !logoutMenuRef.current.contains(e.target)) {
        setShowLogout(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLogout]);

  // ── Load cached requests for expanded collections on mount ──────────────────
  useEffect(() => {
    // Load from localStorage for any collections that were previously expanded
    // This ensures requests are shown immediately without waiting for API
    expandedCollections.forEach(id => {
      loadCollectionRequestsFromStorage(id);
      setInitializedCollections(prev => new Set(prev).add(id));
    });
  }, []);

  // ── Listen for collection import events to auto-expand ──────────────────
  useEffect(() => {
    const handleCollectionImported = (e) => {
      const { collectionId, projectId } = e.detail || {};

      // Expand the collection
      const currentExpanded = expandedCollectionsRef.current;
      if (collectionId && !currentExpanded.has(collectionId)) {
        const next = new Set([...currentExpanded, collectionId]);
        setExpandedCollections(next);
        localStorage.setItem('sidebar_expanded_collections', JSON.stringify([...next]));
        // Fetch requests from API for the newly imported collection
        fetchCollectionRequests(collectionId, true);
      }

      // Expand the parent project so the collection is visible
      if (projectId && !expandedProjects.has(projectId)) {
        const nextProjects = new Set([...expandedProjects, projectId]);
        setExpandedProjects(nextProjects);
        localStorage.setItem('sidebar_expanded_projects', JSON.stringify([...nextProjects]));
      }
    };

    window.addEventListener('collection-imported', handleCollectionImported);
    return () => window.removeEventListener('collection-imported', handleCollectionImported);
  }, [expandedProjects]);

  // ── Sync expanded collections with data (Persistence) ──────────────────
  useEffect(() => {
    if (filteredCollections.length > 0) {
      expandedCollections.forEach(id => {
        const possessesData = requests.some(r => r.collectionId === id);
        const isCurrentlyLoading = loadingCollections[id];
        const isInitialized = initializedCollections.has(id);

        if (!possessesData && !isCurrentlyLoading && !isInitialized) {
          setInitializedCollections(prev => new Set(prev).add(id));
          fetchCollectionRequests(id);
        }
      });
    }
  }, [filteredCollections, expandedCollections, requests.length, loadingCollections, initializedCollections]);

  // ── Permission helpers ──────────────────
  const isTeamOwner = (team) => team?.ownerId?._id === user?._id || team?.ownerId === user?._id;
  const isTeamAdmin = (team) => {
    if (isTeamOwner(team)) return true;
    return team?.members?.some(m =>
      (m.userId?._id || m.userId) === user?._id && m.role === 'admin'
    );
  };
  const isProjectAdmin = (project) => {
    if (project?.ownerId?._id === user?._id || project?.ownerId === user?._id) return true;
    return project?.members?.some(m =>
      (m.userId?._id || m.userId) === user?._id && m.role === 'admin'
    );
  };

  // ── Context Menu Handlers ──────────────────
  const showTeamContextMenu = (e, team) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isTeamAdmin(team)) return; // Only admins (including owner) can edit/delete team

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          id: 'edit',
          label: 'Edit Name',
          icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
          onClick: () => setShowEditNameModal(true, {
            title: 'Edit Team Name',
            itemType: 'Team',
            currentName: team.name,
            onSave: async (name) => {
              const result = await updateTeamName(team._id, name);
              if (result.success) toast.success('Team renamed');
              else toast.error(result.error);
            }
          })
        },
        { id: 'divider', divider: true },
        {
          id: 'delete',
          label: 'Delete Team',
          danger: true,
          icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
          onClick: () => setShowConfirmDialog(true, {
            title: 'Delete Team?',
            message: 'This will permanently delete the team and all its projects, collections, and requests.',
            itemName: team.name,
            onConfirm: async () => {
              const result = await deleteTeam(team._id);
              if (result.success) toast.success('Team deleted');
              else toast.error(result.error);
            }
          })
        }
      ]
    });
  };

  const showProjectContextMenu = (e, project) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProjectAdmin(project)) return; // Only admins can edit/delete project

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          id: 'edit',
          label: 'Edit Name',
          icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
          onClick: () => setShowEditNameModal(true, {
            title: 'Edit Project Name',
            itemType: 'Project',
            currentName: project.name,
            onSave: async (name) => {
              const result = await updateProjectName(project._id, name);
              if (result.success) toast.success('Project renamed');
              else toast.error(result.error);
            }
          })
        },
        { id: 'divider', divider: true },
        {
          id: 'delete',
          label: 'Delete Project',
          danger: true,
          icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
          onClick: () => setShowConfirmDialog(true, {
            title: 'Delete Project?',
            message: 'This will permanently delete the project and all its collections and requests.',
            itemName: project.name,
            onConfirm: async () => {
              const result = await deleteProject(project._id);
              if (result.success) toast.success('Project deleted');
              else toast.error(result.error);
            }
          })
        }
      ]
    });
  };

  const showCollectionContextMenu = (e, collection) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          id: 'add-request',
          label: 'New HTTP Request',
          icon: <span className="text-[10px]">🌐</span>,
          onClick: async () => {
            const newRequest = {
              name: 'New HTTP Request',
              method: 'GET',
              protocol: 'http',
              url: '',
              collectionId: collection._id,
              projectId: currentProject._id,
              teamId: currentTeam._id,
              headers: [{ id: uuidv4(), key: '', value: '', enabled: true }],
              params: [{ id: uuidv4(), key: '', value: '', enabled: true }],
              body: { mode: 'none', raw: '', rawLanguage: 'json', formData: [], urlencoded: [] },
              auth: { type: 'none' }
            };
            const result = await createRequest(newRequest);
            if (result.success) {
              setCurrentRequest(result.request);
              toast.success('HTTP Request created');
            } else {
              toast.error(result.error);
            }
          }
        },
        {
          id: 'add-ws-request',
          label: 'New WebSocket',
          icon: <span className="text-[10px]">⚡</span>,
          onClick: async () => {
            const newRequest = {
              name: 'New WebSocket',
              protocol: 'ws',
              url: 'wss://',
              collectionId: collection._id,
              projectId: currentProject._id,
              teamId: currentTeam._id,
            };
            const result = await createRequest(newRequest);
            if (result.success) {
              setCurrentRequest(result.request);
              toast.success('WebSocket created');
            } else {
              toast.error(result.error);
            }
          }
        },
        {
          id: 'add-sio-request',
          label: 'New Socket.IO',
          icon: <span className="text-[10px]">⬢</span>,
          onClick: async () => {
            const newRequest = {
              name: 'New Socket.IO',
              protocol: 'socketio',
              url: 'http://localhost:3000',
              collectionId: collection._id,
              projectId: currentProject._id,
              teamId: currentTeam._id,
            };
            const result = await createRequest(newRequest);
            if (result.success) {
              setCurrentRequest(result.request);
              toast.success('Socket.IO created');
            } else {
              toast.error(result.error);
            }
          }
        },
        {
          id: 'edit',
          label: 'Edit Name',
          icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
          onClick: () => setShowEditNameModal(true, {
            title: 'Edit Collection Name',
            itemType: 'Collection',
            currentName: collection.name,
            onSave: async (name) => {
              const result = await updateCollectionName(collection._id, name);
              if (result.success) toast.success('Collection renamed');
              else toast.error(result.error);
            }
          })
        },
        { id: 'divider', divider: true },
        {
          id: 'export',
          label: 'Export as Postman',
          icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
          onClick: () => handleExportCollection(null, collection)
        },
        { id: 'divider', divider: true },
        {
          id: 'delete',
          label: 'Delete Collection',
          danger: true,
          icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
          onClick: () => setShowConfirmDialog(true, {
            title: 'Delete Collection?',
            message: 'This will permanently delete the collection and all its requests.',
            itemName: collection.name,
            onConfirm: async () => {
              const result = await deleteCollection(collection._id);
              if (result.success) toast.success('Collection deleted');
              else toast.error(result.error);
            }
          })
        }
      ]
    });
  };



  const showWorkflowContextMenu = (e, wf) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          id: 'rename',
          label: 'Rename Workflow',
          icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
          onClick: () => setShowEditNameModal(true, {
            title: 'Rename Workflow',
            itemType: 'Workflow',
            currentName: wf.name || 'Untitled Workflow',
            onSave: async (name) => {
              if (currentWorkflow?.id === wf.id) {
                updateWorkflowField('name', name);
                await saveWorkflow();
              } else {
                const updated = { ...wf, name };
                openWorkflow(updated);
                await saveWorkflow();
                if (currentTeam) fetchWorkflows(currentTeam._id, currentProject?._id);
              }
              toast.success('Workflow renamed');
            }
          })
        },
        { id: 'divider', divider: true },
        {
          id: 'delete',
          label: 'Delete Workflow',
          danger: true,
          icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
          onClick: () => setShowConfirmDialog(true, {
            title: 'Delete Workflow?',
            message: 'This will permanently delete this workflow. This action cannot be undone.',
            itemName: wf.name || 'Untitled Workflow',
            onConfirm: async () => {
              const result = await deleteWorkflow(wf.id);
              if (result.success) {
                if (currentWorkflow?.id === wf.id) {
                  await newWorkflow(currentTeam?._id, currentProject?._id);
                }
              }
            }
          })
        }
      ]
    });
  };

  const showRequestContextMenu = (e, request) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          id: 'edit',
          label: 'Edit Name',
          icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
          onClick: () => setShowEditNameModal(true, {
            title: 'Edit Request Name',
            itemType: 'Request',
            currentName: request.name,
            onSave: async (name) => {
              const result = await updateRequestName(request._id, name);
              if (result.success) {
                toast.success('Request renamed');
              } else {
                toast.error(result.error);
              }
            }
          })
        },
        { id: 'divider', divider: true },
        {
          id: 'delete',
          label: 'Delete Request',
          danger: true,
          icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
          onClick: () => setShowConfirmDialog(true, {
            title: 'Delete Request?',
            message: 'This will permanently delete this request.',
            itemName: request.name,
            onConfirm: async () => {
              const result = await deleteRequest(request._id, request.collectionId);
              if (result.success) {
                // 1. Remove from collection store state + localStorage
                removeRequest(request._id, request.collectionId);

                toast.success('Request deleted');

                // 2. If this was the currently open request, navigate away
                if (currentRequest?._id === request._id) {
                  // Find all remaining requests in the same collection
                  const siblings = useCollectionStore.getState().requests.filter(
                    (r) => r.collectionId === request.collectionId && r._id !== request._id
                  );

                  if (siblings.length > 0) {
                    // Open the last one (closest sibling in list order)
                    setCurrentRequest(siblings[siblings.length - 1]);
                  } else {
                    // No requests left — show empty state
                    setNoActiveRequest(true);
                  }
                }
              } else {
                toast.error(result.error);
              }
            }
          })
        }
      ]
    });
  };

  const handleLogout = () => {
    disconnect();
    logout();
    toast.success('Signed out successfully');
  };

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
      // Automatically fetch requests from API if they aren't in local storage/state
      if (!initializedCollections.has(id)) {
        setInitializedCollections(prev => new Set(prev).add(id));
        fetchCollectionRequests(id);
      }
      // Ensure it becomes current
      setCurrentCollection(col);
    }
  };

  const handleExportCollection = async (e, col) => {
    if (e) e.stopPropagation();

    const toastId = toast.loading(`Preparing ${col.name} for export...`);
    try {
      // 1. Ensure we have all requests for this collection
      if (!initializedCollections.has(col._id)) {
        setInitializedCollections(prev => new Set(prev).add(col._id));
        await fetchCollectionRequests(col._id);
      }

      // 2. Get requests belonging to this collection
      const colRequests = requests.filter(r => r.collectionId === col._id);

      // 3. Convert to Postman format
      const { exportToPostman } = await import('@/utils/postmanExporter');
      const postmanData = exportToPostman(col, colRequests);
      const jsonString = JSON.stringify(postmanData, null, 2);

      // 4. Save file using Tauri dialog
      const { save } = await import('@tauri-apps/api/dialog');
      const { writeTextFile } = await import('@tauri-apps/api/fs');

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

  const toggleProject = (projectId) => {
    const next = new Set(expandedProjects);
    if (next.has(projectId)) next.delete(projectId);
    else next.add(projectId);
    setExpandedProjects(next);
    localStorage.setItem('sidebar_expanded_projects', JSON.stringify([...next]));
  };

  const toggleFolder = (fid) => {
    const next = new Set(expandedFolders);
    next.has(fid) ? next.delete(fid) : next.add(fid);
    setExpandedFolders(next);
  };

  // ── Remote Search ──────────────────
  useEffect(() => {
    if (!searchQuery.trim() || !currentProject) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await api.get(`/api/request?projectId=${currentProject._id}&search=${encodeURIComponent(searchQuery.trim())}`);
        setSearchResults(data.requests || []);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, currentProject?._id]);

  return (
    <div className="sdbv2-container" style={{ width, minWidth: width }}>
      {/* Activity Bar - Minimal VS Code style */}
      <nav className="sdbv2-activity-bar">
        <div className="sdbv2-activity-top">
          {NAV_ITEMS.map((item) => {
            const isActive = activeV2Nav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveV2Nav(item.id);
                  if (item.id === 'environments') onOpenEnvPanel?.();
                }}
                className={`sdbv2-activity-item ${isActive ? 'sdbv2-activity-item--active' : ''}`}
                title={item.label}
              >
                {item.icon}
              </button>
            );
          })}
        </div>

        <div className="sdbv2-activity-bottom">
          <button
            className="sdbv2-activity-item"
            onClick={() => setShowInviteModal(true)}
            title="Team"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>
          <button
            className="sdbv2-activity-avatar"
            onClick={() => setShowLogout(!showLogout)}
            title={user?.email || 'Profile'}
          >
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </button>

          {showLogout && (
            <div ref={logoutMenuRef} className="sdbv2-logout-menu">
              <div className="sdbv2-logout-email">{user?.email}</div>
              <button className="sdbv2-logout-btn" onClick={handleLogout}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <aside className="sdbv2-main">
        {/* Logo & App Name */}
        <div className="sdbv2-header">
          <div className="sdbv2-logo-row">
            <PayloadX className="w-5 h-5" fontSize="8px" />
            <div className="sdbv2-logo-text">
              <span className="sdbv2-app-name"><span className="metallic-app-name">PayloadX</span> <span className="ml-1 px-1.5 py-0.5 text-[8px] font-bold bg-white/5 border border-white/10 rounded text-gray-500 uppercase tracking-wider">Beta</span></span>
              {currentTeam && (
                <span className="sdbv2-team-tag">
                  {currentTeam.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="sdbv2-search-wrap">
          <svg className="sdbv2-search-icon" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="sdbv2-search-input"
            placeholder="Search requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="sdbv2-tree-body">
          {searchQuery ? (
            <div className="sdbv2-section">
              <div className="sdbv2-section-head">
                <span className="sdbv2-section-label">Search Results</span>
              </div>
              {isSearching ? (
                <p className="sdbv2-empty-note">Searching database...</p>
              ) : searchResults?.length > 0 ? (
                searchResults.map((req) => (
                  <SidebarRequest key={`search-${req._id}`} request={req} onSelect={handleRequestSelect} />
                ))
              ) : (
                <p className="sdbv2-empty-note">No matches found in project</p>
              )}
            </div>
          ) : activeV2Nav === 'workflow' ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Workflows List */}
              <div className="sdbv2-section shrink-0 max-h-[40%] flex flex-col">
                <div className="sdbv2-section-head">
                  <span className="sdbv2-section-label">My Workflows</span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <RefreshButton
                      onRefresh={() => currentTeam && fetchWorkflows(currentTeam._id, currentProject?._id)}
                      tooltip="Refresh Workflows"
                      size={12}
                    />
                    {/* New Workflow */}
                    <button
                      className="sdbv2-section-add"
                      onClick={handleCreateWorkflow}
                      disabled={isCreatingWorkflow}
                      title="New Workflow"
                    >
                      {isCreatingWorkflow ? (
                        <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      ) : (
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1 mt-1 overflow-y-auto pr-1">
                  {workflows.filter(w => !currentProject || w.projectId === currentProject._id).length > 0 ? (
                    workflows
                      .filter(w => !currentProject || w.projectId === currentProject._id)
                      .map((wf) => (
                        <div
                          key={wf.id}
                          className={`sdbv2-tree-row w-full group relative ${currentWorkflow?.id === wf.id ? 'sdbv2-tree-row--active' : ''}`}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => openWorkflow(wf)}
                          onContextMenu={(e) => showWorkflowContextMenu(e, wf)}
                        >
                          {/* Bolt icon */}
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--accent)', flexShrink: 0 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>

                          <span
                            className="sdbv2-tree-text flex-1 text-left"
                            title={wf.name || 'Untitled Workflow'}
                          >
                            {wf.name || 'Untitled Workflow'}
                          </span>
                        </div>
                      ))
                  ) : (
                    <div
                      className="sdbv2-empty-cta"
                      onClick={() => !isCreatingWorkflow && handleCreateWorkflow()}
                      style={{ cursor: isCreatingWorkflow ? 'default' : 'pointer', textAlign: 'center', padding: '12px 8px' }}
                    >
                      {isCreatingWorkflow ? (
                        <svg className="w-5 h-5 animate-spin mx-auto mb-1 text-[var(--accent)]" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      ) : (
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)', margin: '0 auto 4px' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                      <p className="sdbv2-empty-note" style={{ textAlign: 'center' }}>{isCreatingWorkflow ? 'Creating...' : 'No workflows yet'}</p>
                      {!isCreatingWorkflow && <p style={{ fontSize: '10px', color: 'var(--accent)', marginTop: '2px' }}>Click to create one</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* APIs List (for drag and drop) */}
              <div className="sdbv2-section flex-1 flex flex-col min-h-0 border-t border-[var(--border-1)] mt-2 pt-2">
                <div className="sdbv2-section-head">
                  <span className="sdbv2-section-label">Drag APIs to Canvas</span>
                </div>
                <div className="flex-1 overflow-y-auto pr-1 mt-1">
                  {currentProject ? (
                    (() => {
                      const projectCollections = collectionsByProject[currentProject._id] || [];
                      if (projectCollections.length === 0) {
                        return <p className="sdbv2-empty-note p-4 text-center">No collections in this project</p>;
                      }

                      return projectCollections.map((col) => {
                        // Load requests for this collection from storage if not already in store
                        const storeRequests = requests.filter(r => r.collectionId === col._id);
                        const localRequests = storeRequests.length > 0 
                          ? storeRequests 
                          : localStorageService.getRequests(col._id);

                        if (localRequests.length === 0) return null;

                        return (
                          <div key={col._id} className="mb-2">
                            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2 mb-1 opacity-50 flex items-center gap-1">
                              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                              {col.name}
                            </div>
                            {localRequests.map(req => (
                              <SidebarRequest
                                key={req._id}
                                request={req}
                                onSelect={() => { }} // No-op on click in workflow mode, just drag
                                isActive={false}
                              />
                            ))}
                          </div>
                        );
                      });
                    })()
                  ) : (
                    <p className="sdbv2-empty-note p-4 text-center">Select a project to see APIs</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Grouped Projects & Collections - Only show when project is selected */}
              {currentProject ? (
                <div className="sdbv2-section">
                  <div className="sdbv2-section-head clickable" onClick={() => setShowCollectionsSection(!showCollectionsSection)}>
                    <div className="flex items-center gap-1">
                      <svg className={`sdbv2-chevron ${showCollectionsSection ? 'sdbv2-chevron--open' : ''}`} width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="sdbv2-section-label">All Collections</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <RefreshButton
                        onRefresh={async () => {
                          if (currentTeam) {
                            const res = await syncAll(currentTeam._id);
                            if (res.success) toast.success('Workspace synced');
                            else toast.error('Sync failed');
                          }
                        }}
                        loading={isRefreshingCollections}
                        tooltip="Sync everything"
                        size={12}
                      />
                      <button className="sdbv2-section-add" onClick={onShowImportModal} title="Import">
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      </button>
                      <button className="sdbv2-section-add" onClick={onShowCollectionModal} title="New collection">
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      </button>
                    </div>
                  </div>

                  {showCollectionsSection && (
                    <div className="flex flex-col gap-1 mt-1">
                      {filteredProjects.map((project) => {
                        const projectCollections = collectionsByProject[project._id] || [];
                        const isProjExp = expandedProjects.has(project._id);

                        return (
                          <div key={project._id} className="mb-1">
                            {/* Project Header */}
                            <button
                              onClick={() => toggleProject(project._id)}
                              className="sdbv2-tree-row w-full opacity-80 hover:opacity-100"
                              style={{ paddingLeft: '4px' }}
                            >
                              <svg className={`sdbv2-chevron ${isProjExp ? 'sdbv2-chevron--open' : ''}`} width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                              </svg>
                              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: project.color || 'var(--brand-500)', flexShrink: 0 }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                              <span className="sdbv2-tree-text font-bold uppercase tracking-wider text-[9px] truncate">{project.name}</span>
                            </button>

                            {/* Collections in Project */}
                            {isProjExp && (
                              <div className="sdbv2-indent ml-2">
                                {projectCollections.map((col) => {
                                  const isExp = expandedCollections.has(col._id);
                                  return (
                                    <div key={col._id}>
                                      <div className="group relative pr-1">
                                        <button
                                          onClick={() => toggleCollection(col)}
                                          onContextMenu={(e) => showCollectionContextMenu(e, col)}
                                          className={`sdbv2-tree-row w-full ${currentCollection?._id === col._id ? 'sdbv2-tree-row--active' : ''}`}>
                                          <svg className={`sdbv2-chevron ${isExp ? 'sdbv2-chevron--open' : ''}`} width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                          </svg>
                                          <span className="sdbv2-tree-text flex-1 text-left">{col.name}</span>
                                        </button>

                                        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <RefreshButton
                                            onRefresh={async () => {
                                              setRefreshingColId(col._id);
                                              const result = await refreshCollectionRequests(col._id);
                                              setRefreshingColId(null);
                                              if (result.success) toast.success(`Synced ${col.name}`);
                                              else toast.error('Sync failed');
                                            }}
                                            loading={refreshingColId === col._id}
                                            tooltip="Refresh APIs"
                                            size={12}
                                          />
                                        </div>
                                      </div>
                                      {isExp && (
                                        <div className="sdbv2-indent animate-in">
                                          {loadingCollections[col._id] ? (
                                            <div className="flex flex-col gap-1 py-1 pr-2 pl-4">
                                              <div className="h-6 w-full bg-[var(--surface-3)] rounded-md animate-pulse" />
                                              <div className="h-6 w-[80%] bg-[var(--surface-2)] rounded-md animate-pulse" />
                                            </div>
                                          ) : (
                                            <>
                                              {(col.folders || []).map(folder => {
                                                const isFolderExp = expandedFolders.has(folder._id);
                                                return (
                                                  <div key={folder._id}>
                                                    <button onClick={() => toggleFolder(folder._id)} className="sdbv2-tree-row">
                                                      <svg className={`sdbv2-chevron ${isFolderExp ? 'sdbv2-chevron--open' : ''}`} width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                      </svg>
                                                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--warning)', flexShrink: 0 }}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                      </svg>
                                                      <span className="sdbv2-tree-text">{folder.name}</span>
                                                    </button>
                                                    {isFolderExp && requests.filter(r => r.folderId === folder._id).map(req => (
                                                      <SidebarRequest key={req._id} request={req} onSelect={handleRequestSelect} isActive={currentRequest?._id === req._id} />
                                                    ))}
                                                  </div>
                                                );
                                              })}
                                              {requests.filter(r => r.collectionId === col._id && !r.folderId).map(req => (
                                                <SidebarRequest
                                                  key={req._id}
                                                  request={req}
                                                  onSelect={handleRequestSelect}
                                                  isActive={currentRequest?._id === req._id}
                                                  onContextMenu={(e) => showRequestContextMenu(e, req)}
                                                />
                                              ))}
                                              {requests.filter(r => r.collectionId === col._id).length === 0 && (col.folders || []).length === 0 && (
                                                <div className="sdbv2-empty-note py-1 pl-4 opacity-50">Empty collection</div>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {projectCollections.length === 0 && <p className="sdbv2-empty-note ml-4">No collections yet</p>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {filteredProjects.length === 0 && <p className="sdbv2-empty-note">No projects yet</p>}
                    </div>
                  )}
                </div>
              ) : (
                <div className="sdbv2-section">
                  <div className="sdbv2-section-head">
                    <span className="sdbv2-section-label">Collections</span>
                  </div>
                  <p className="sdbv2-empty-note p-4 text-center">Select a project to view collections</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Creator attribution */}
        <div style={{ padding: '12px', borderTop: '1px solid var(--border-1)', opacity: 0.3, marginTop: 'auto' }}>
          <p style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted)' }}>
            Project by <span style={{ color: 'var(--text-primary)' }}>Sundan Sharma</span>
          </p>
        </div>
      </aside>
    </div>
  );
}

function SidebarRequest({ request, onSelect, isActive, onContextMenu }) {
  const { requestViewers } = useSocketStore();
  const { user: currentUser } = useAuthStore();

  const viewers = (requestViewers[request._id] || []).filter(v =>
    (v._id || v.id) !== currentUser?._id && (v._id || v.id) !== currentUser?.id
  );

  // Unique by user ID
  const uniqueViewers = [];
  const seenIds = new Set();
  viewers.forEach(v => {
    const id = v._id || v.id;
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      uniqueViewers.push(v);
    }
  });

  const isWs = request.protocol === 'ws';
  const isSio = request.protocol === 'socketio';
  const color = isWs ? '#38bdf8' : isSio ? '#f0883e' : (METHOD_COLORS[request.method] || '#9A9A9A');

  const onDragStart = (event) => {
    try {
      const data = JSON.stringify(request);
      event.dataTransfer.setData('application/json', data);
      event.dataTransfer.setData('application/reactflow', 'api');
      event.dataTransfer.setData('text/plain', data);
      event.dataTransfer.setData('text', data);
      event.dataTransfer.effectAllowed = 'all';
    } catch (e) {
      console.error('Error in onDragStart:', e);
    }
  };

  return (
    <div
      onClick={() => onSelect(request)}
      onContextMenu={onContextMenu}
      draggable={true}
      onDragStart={onDragStart}
      className={`sdbv2-tree-row sdbv2-req-row ${isActive ? 'sdbv2-tree-row--active' : ''} relative cursor-grab active:cursor-grabbing select-none group`}
      title="Drag to workflow canvas"
      role="button"
      tabIndex={0}
    >
      <span className="sdbv2-method-badge" style={{
        color,
        background: `${color}18`,
        fontSize: (isWs || isSio) ? '9px' : '10px',
        visibility: (isWs || isSio) || request.method ? 'visible' : 'hidden'
      }}>
        {isWs ? 'WS' : isSio ? 'SIO' : (request.method || 'GET')}
      </span>
      <span className="sdbv2-tree-text flex-1 truncate">{request.name}</span>

      {/* Real-time Viewers */}
      {uniqueViewers.length > 0 && (
        <div className="flex items-center -space-x-1 ml-auto mr-1 animate-in fade-in zoom-in-75 duration-300">
          {uniqueViewers.slice(0, 2).map((v, i) => (
            <div
              key={v.socketId || i}
              title={`${v.name || v.email} is viewing`}
              className="w-3.5 h-3.5 rounded-full border border-[var(--bg-primary)] flex items-center justify-center text-[6px] font-bold text-white shadow-sm"
              style={{ background: stringToColor(v.name || v.email || '?') }}
            >
              {(v.name || v.email || '?')[0].toUpperCase()}
            </div>
          ))}
          {uniqueViewers.length > 2 && (
            <div className="w-3.5 h-3.5 rounded-full border border-[var(--bg-primary)] bg-[var(--surface-3)] flex items-center justify-center text-[6px] font-bold text-[var(--text-muted)]">
              +{uniqueViewers.length - 2}
            </div>
          )}
        </div>
      )}

      <span className={`text-[10px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 ${uniqueViewers.length > 0 ? 'hidden' : ''}`}>
        ⋮⋮
      </span>
    </div>
  );
}

function stringToColor(str) {
  const PALETTE = [
    '#7c3aed', '#2563eb', '#db2777', '#d97706',
    '#059669', '#dc2626', '#0891b2', '#9333ea',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
