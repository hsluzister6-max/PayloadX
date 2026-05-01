import { useState, useEffect, useRef } from 'react';
import { isTauri } from '@/lib/executor';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { useUIStore } from '@/store/uiStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useTeamStore } from '@/store/teamStore';
import { useRequestStore } from '@/store/requestStore';
import SplashScreen from '@/components/SplashScreen/SplashScreen';
import AuthPage from '@/components/Auth/AuthPage';
import Sidebar from '@/components/Sidebar/Sidebar';
import RequestBuilder from '@/components/RequestBuilder/RequestBuilder';
import WSRequestBuilder from '@/components/RequestBuilder/WSRequestBuilder';
import ResponseViewer from '@/components/ResponseViewer/ResponseViewer';
import EnvironmentPanel from '@/components/EnvironmentPanel/EnvironmentPanel';
import ImportModal from '@/components/ImportModal/ImportModal';
import CreateTeamModal, {
  CreateProjectModal,
  CreateCollectionModal,
  CreateFolderModal,
  InviteModal,
} from '@/components/Modals/Modals';
import SessionManagerModal from '@/components/Modals/SessionManagerModal';
import EnvironmentSelector from '@/components/EnvironmentSelector/EnvironmentSelector';
import LayoutV2 from '@/components/LayoutV2/LayoutV2';
import ContextMenu from '@/components/ContextMenu/ContextMenu';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import EditNameModal from '@/components/EditNameModal/EditNameModal';
import UnsavedChangesModal from '@/components/Modals/UnsavedChangesModal';
import SyncStatusTag from '@/components/SyncStatusTag/SyncStatusTag';
import OfflineSyncManager from '@/components/OfflineSyncManager/OfflineSyncManager';
import { useProjectStore } from '@/store/projectStore';
import { useWorkflowStore, defaultWorkflow } from '@/store/workflowStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function App() {
  useKeyboardShortcuts();
  const [showSplash, setShowSplash] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);

  const { user, fetchMe } = useAuthStore();
  const {
    connect,
    isConnected,
    joinTeam,
    onRequestUpdated,
    onCollectionUpdated,
    onCollectionCreated,
    onCollectionImported,
    onTeamUpdated,
    onTeamDeleted,
    onProjectUpdated,
    onProjectDeleted,
    onCollectionDeleted,
    onRequestDeleted,
    onRequestCreated,
    onWorkflowCreated,
    onWorkflowUpdated,
    onWorkflowDeleted
  } = useSocketStore();
  const { workflows, fetchWorkflows } = useWorkflowStore();
  const { currentTeam, initFromStorage: initTeams, updateTeamName, deleteTeam, fetchTeams, teams } = useTeamStore();
  const { initFromStorage: initProjects, updateProjectName, deleteProject, fetchProjects, projects } = useProjectStore();
  const { updateRequest, updateCollection, deleteCollection, addRequest, initFromStorage: initCollections } = useCollectionStore();
  const {
    sidebarWidth,
    setSidebarWidth,
    responseHeight,
    setResponseHeight,
    showImportModal,
    showTeamModal,
    showProjectModal,
    showCollectionModal,
    showFolderModal,
    showEnvironmentPanel,
    showInviteModal,
    showConfirmDialog,
    showEditNameModal,
    showSessionModal,
    theme,
    layoutVersion,
    toggleLayout,
  } = useUIStore();

  // Fetch user on mount and initialize data from localStorage
  useEffect(() => {
    const attemptAuthCheck = async () => {
      if (navigator.onLine) {
        try {
          // Wrap in a small timeout to avoid long hangs on unreliable connections
          await Promise.race([
            fetchMe(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Auth Timeout')), 5000))
          ]);
        } catch (e) {
          console.log('[App] Auth check skipped or timed out:', e.message);
        }
      }
    };

    const initData = async () => {
      await attemptAuthCheck();

      // Initialize stores from localStorage for offline-first experience
      initTeams();
      initProjects();
      initCollections();
    };

    // Check on initial load
    initData();

    // Re-check auth immediately when network comes back online
    window.addEventListener('online', attemptAuthCheck);

    return () => {
      window.removeEventListener('online', attemptAuthCheck);
    };
  }, []);

  // Fetch from API if localStorage is empty (first time load)
  useEffect(() => {
    if (user && teams.length === 0) {
      fetchTeams();
    }
  }, [user, teams.length]);

  useEffect(() => {
    if (user && currentTeam && projects.length === 0) {
      fetchProjects(currentTeam._id);
    }
  }, [user, currentTeam, projects.length]);

  useEffect(() => {
    if (user && currentTeam && workflows.length === 0) {
      fetchWorkflows(currentTeam._id);
    }
  }, [user, currentTeam, workflows.length]);


  // Apply theme class to <html> so CSS variables switch correctly
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [theme]);

  // Connect socket when user logs in
  useEffect(() => {
    if (user) {
      connect();
    }
  }, [user]);

  // Join socket room whenever the current team changes
  useEffect(() => {
    if (user && currentTeam && isConnected) {
      joinTeam(currentTeam._id, user);
    }
  }, [currentTeam, isConnected]);

  // Real-time listeners
  useEffect(() => {
    if (!isConnected) return;

    const offRequest = onRequestUpdated(({ request }) => {
      updateRequest(request);

      const reqStore = useRequestStore.getState();
      if (reqStore.currentRequest?._id === request._id) {
        reqStore.setCurrentRequest(request);
      }
    });
    const offCollection = onCollectionUpdated(({ collection }) => {
      updateCollection(collection);
    });
    const offCollectionCreatedListener = onCollectionCreated(({ collection }) => {
      // Only add if not already present (prevent duplicates)
      const { collections } = useCollectionStore.getState();
      if (!collections.find(c => c._id === collection._id)) {
        useCollectionStore.setState({ collections: [...collections, collection] });
      }
    });
    const offImport = onCollectionImported(({ collection }) => {
      updateCollection(collection);
    });

    return () => {
      offRequest?.();
      offCollection?.();
      offCollectionCreatedListener?.();
      offImport?.();
    };
  }, [isConnected]);

  // Additional real-time sync listeners for teams, projects, collections, requests
  useEffect(() => {
    if (!isConnected) return;

    const offTeamUpdated = onTeamUpdated(({ team }) => {
      updateTeamName(team._id, team.name);
    });
    const offTeamDeleted = onTeamDeleted(({ teamId }) => {
      deleteTeam(teamId);
    });
    const offProjectUpdated = onProjectUpdated(({ project }) => {
      updateProjectName(project._id, project.name);
    });
    const offProjectDeleted = onProjectDeleted(({ projectId }) => {
      deleteProject(projectId);
    });
    const offCollectionDeleted = onCollectionDeleted(({ collectionId }) => {
      deleteCollection(collectionId);
    });
    const offRequestDeleted = onRequestDeleted(({ requestId, collectionId }) => {
      // Correctly remove from collection store
      useCollectionStore.getState().removeRequest(requestId, collectionId);

      // If it was open in requestStore, handle closing it
      const reqStore = useRequestStore.getState();
      if (reqStore.currentRequest?._id === requestId) {
        reqStore.setNoActiveRequest(true);
      }
    });
    const offRequestCreated = onRequestCreated(({ request, userId }) => {
      // Don't add if we are the creator (already handled locally)
      if (userId === user._id || userId === user.id) return;
      addRequest(request);
    });

    const offWorkflowCreated = onWorkflowCreated(({ workflow, userId }) => {
      if (userId === user._id || userId === user.id) return;
      const { workflows } = useWorkflowStore.getState();
      if (!workflows.find(w => w.id === workflow.id)) {
        useWorkflowStore.setState({ workflows: [...workflows, workflow] });
      }
    });

    const offWorkflowUpdated = onWorkflowUpdated(({ workflow, userId }) => {
      if (userId === user._id || userId === user.id) return;
      const { workflows, currentWorkflow } = useWorkflowStore.getState();
      const updatedWorkflows = workflows.map(w => w.id === workflow.id ? workflow : w);
      const newState = { workflows: updatedWorkflows };
      if (currentWorkflow?.id === workflow.id) {
        newState.currentWorkflow = workflow;
      }
      useWorkflowStore.setState(newState);
    });

    const offWorkflowDeleted = onWorkflowDeleted(({ workflowId, userId }) => {
      if (userId === user._id || userId === user.id) return;
      const { workflows, currentWorkflow } = useWorkflowStore.getState();
      const updatedWorkflows = workflows.filter(w => w.id !== workflowId);
      const newState = { workflows: updatedWorkflows };
      if (currentWorkflow?.id === workflowId) {
        newState.currentWorkflow = defaultWorkflow(); // Need to import or define this, but useWorkflowStore has it
      }
      useWorkflowStore.setState(newState);
    });

    return () => {
      offTeamUpdated?.();
      offTeamDeleted?.();
      offProjectUpdated?.();
      offProjectDeleted?.();
      offCollectionDeleted?.();
      offRequestDeleted?.();
      offRequestCreated?.();
      offWorkflowCreated?.();
      offWorkflowUpdated?.();
      offWorkflowDeleted?.();
    };
  }, [isConnected]);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (!user) {
    return (
      <>
        <AuthPage />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: theme === 'light' ? '#FFFFFF' : '#1A1F2B',
              color: theme === 'light' ? '#111111' : '#D8DEE9',
              border: `1px solid ${theme === 'light' ? '#E1E4E8' : 'rgba(216, 222, 233, 0.1)'}`,
              borderRadius: '12px',
              fontSize: '13px',
              fontFamily: 'Poppins, sans-serif',
            },
          }}
        />
      </>
    );
  }

  // ─── V2 Layout ─────────────────────────────────────────────────
  if (layoutVersion === 'v2') {
    return (
      <>
        <OfflineSyncManager />
        <LayoutV2
          onShowTeamModal={() => useUIStore.getState().setShowTeamModal(true)}
          onShowProjectModal={() => useUIStore.getState().setShowProjectModal(true)}
          onShowCollectionModal={() => useUIStore.getState().setShowCollectionModal(true)}
          onShowImportModal={() => useUIStore.getState().setShowImportModal(true)}
          onOpenEnvPanel={() => useUIStore.getState().openRightSidebarTab('environment')}
        />

        {/* Shared Modals */}
        {showImportModal && <ImportModal />}
        {showTeamModal && <CreateTeamModal />}
        {showProjectModal && <CreateProjectModal />}
        {showCollectionModal && <CreateCollectionModal />}
        {showFolderModal && <CreateFolderModal />}
        {showInviteModal && <InviteModal />}
        <ContextMenu />
        <ConfirmDialog />
        <EditNameModal />
        <UnsavedChangesModal />
        {showSessionModal && <SessionManagerModal />}



        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: theme === 'light' ? '#FFFFFF' : '#1A1F2B',
              color: theme === 'light' ? '#111111' : '#D8DEE9',
              border: `1px solid ${theme === 'light' ? '#E1E4E8' : 'rgba(216, 222, 233, 0.1)'}`,
              borderRadius: '12px',
              fontSize: '13px',
              fontFamily: 'Poppins, sans-serif',
            },
          }}
        />
      </>
    );
  }

  // ─── V1 Layout (Classic — unchanged) ───────────────────────────
  return (
    <>
      <OfflineSyncManager />
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
        {/* Sidebar */}
        <div style={{ width: sidebarWidth }} className="flex-shrink-0 h-full overflow-hidden flex flex-col">
          <Sidebar />
        </div>

        {/* Sidebar resize handle */}
        <div
          className="w-1 cursor-col-resize bg-surface-700/30 hover:bg-brand-500/50 transition-colors flex-shrink-0 relative group"
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startW = sidebarWidth;
            const onMove = (e) => setSidebarWidth(startW + (e.clientX - startX));
            const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-brand-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Top bar — V1 with added layout toggle */}
          <div className="flex items-center justify-between h-10 px-3 border-b border-[var(--border-1)] bg-surface-900 flex-shrink-0">
            <div className="flex items-center gap-2">
              {currentTeam && (
                <span className="text-surface-500 text-xs">
                  {currentTeam.name}
                </span>
              )}
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-success' : 'bg-surface-600'} animate-pulse-slow`} title={isConnected ? 'Real-time connected' : 'Offline'} />
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <SyncStatusTag />
              <EnvironmentSelector />
              {!isTauri() && (
                <div className="flex items-center gap-1.5 bg-warning/10 border border-warning/20 text-warning text-[10px] px-2.5 py-1 rounded-lg">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Browser mode
                </div>
              )}
              {/* ← Switch to V2 */}
              <button
                onClick={toggleLayout}
                title="Switch to New Layout (V2)"
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg transition-all"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-1)',
                  color: 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-1)'; }}
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                New UI
              </button>
            </div>
          </div>

          {/* Request builder */}
          <div className="flex-1 overflow-hidden">
            {useRequestStore.getState().currentRequest?.protocol === 'ws' ? (
              <WSRequestBuilder />
            ) : (
              <RequestBuilder />
            )}
          </div>

          {/* Response height resize handle */}
          <div
            className="h-1 cursor-row-resize bg-surface-700/30 hover:bg-brand-500/50 transition-colors flex-shrink-0"
            onMouseDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startH = responseHeight;
              const onMove = (e) => setResponseHeight(startH + (startY - e.clientY));
              const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          />

          {/* Response viewer */}
          <div style={{ height: responseHeight }} className="flex-shrink-0 border-t border-[var(--border-1)] overflow-hidden bg-surface-850">
            <ResponseViewer />
          </div>
        </div>

        {/* Modals */}
        {showEnvironmentPanel && <EnvironmentPanel />}
        {showImportModal && <ImportModal />}
        {showTeamModal && <CreateTeamModal />}
        {showProjectModal && <CreateProjectModal />}
        {showCollectionModal && <CreateCollectionModal />}
        {showFolderModal && <CreateFolderModal />}
        {showInviteModal && <InviteModal />}
        {showSessionModal && <SessionManagerModal />}
        <ContextMenu />
        <ConfirmDialog />
        <EditNameModal />

        {/* Toast notifications */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: theme === 'light' ? '#FFFFFF' : '#1A1F2B',
              color: theme === 'light' ? '#111111' : '#D8DEE9',
              border: `1px solid ${theme === 'light' ? '#E1E4E8' : 'rgba(216, 222, 233, 0.1)'}`,
              borderRadius: '12px',
              fontSize: '13px',
              fontFamily: 'Poppins, sans-serif',
            },
          }}
        />
      </div>
    </>
  );
}
