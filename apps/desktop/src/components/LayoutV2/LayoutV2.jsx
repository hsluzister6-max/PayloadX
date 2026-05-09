import { useState, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useRequestStore } from '@/store/requestStore';
import TopBarV2 from './TopBarV2';
import SidebarV2 from './SidebarV2';
import EmptyState from './EmptyState';
import RequestBuilder from '@/components/RequestBuilder/RequestBuilder';
import WSRequestBuilder from '@/components/RequestBuilder/WSRequestBuilder';
import SIORequestBuilder from '@/components/RequestBuilder/SIORequestBuilder';
import Dashboard from '@/components/Dashboard/Dashboard';
import ResponseViewer from '@/components/ResponseViewer/ResponseViewer';
import ApiDocsPanel from '@/components/ApiDocs/ApiDocsPanel';
import InlineDocViewer from '@/components/ResponseViewer/InlineDocViewer';
import RightSidebar from './RightSidebar';
import WorkflowBuilder from '@/components/WorkflowBuilder/WorkflowBuilder';
import HistoryPanel from '@/components/History/HistoryPanel.jsx';
import toast from 'react-hot-toast';
import SyncSidebar from '@/components/Sync/SyncSidebar';
import api from '@/lib/api';

export default function LayoutV2({
  onShowTeamModal,
  onShowProjectModal,
  onShowCollectionModal,
  onShowImportModal,
  onOpenEnvPanel,
}) {
  const {
    responseHeight,
    setResponseHeight,
    sidebarWidth,
    setSidebarWidth,
    sidebarV2Open,
    toggleSidebarV2,
    workspaceOrientation,
    toggleOrientation,
    activeV2Nav,
    theme,
    setContextMenu,
  } = useUIStore();

  const [rightPanelTab, setRightPanelTab] = useState('Response');
  const [splitPercent, setSplitPercent] = useState(50);
  const [syncDiff, setSyncDiff] = useState(null);
  const [showSyncSidebar, setShowSyncSidebar] = useState(false);
  const [hasNewSync, setHasNewSync] = useState(false);

  const { teams, currentTeam } = useTeamStore();
  const { projects, currentProject } = useProjectStore();
  const { currentCollection } = useCollectionStore();
  const { currentRequest, openTabs, activeTabId, setActiveTabId, closeTab, closeAllTabs, closeOtherTabs, closeTabsToLeft, closeTabsToRight, saveRequest } = useRequestStore();
  const { setShowUnsavedModal } = useUIStore();

  const handleCloseTab = (id) => {
    const tab = openTabs.find(t => t.id === id);
    if (tab?.isDirty) {
      setShowUnsavedModal(true, {
        tabId: id,
        requestName: tab.request.name,
        onSave: async () => {
          // If the tab to close is not the active one, we need to switch to it to save
          // but saveRequest in store uses currentRequest.
          // This is a limitation of the current store.
          // For now, let's just save if it's the active one.
          if (activeTabId === id) {
            const result = await saveRequest();
            if (result.success) closeTab(id);
          } else {
            // Logic to save a non-active tab would go here
            closeTab(id);
          }
        },
        onDontSave: () => {
          closeTab(id);
        }
      });
    } else {
      closeTab(id);
    }
  };

  // Check if user needs onboarding (no teams or projects)
  const needsOnboarding = teams.length === 0 || projects.length === 0 || !currentProject;



  // AST CLI WebSocket Listener
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:4040');
    
    ws.onopen = () => {
      console.log('[PayloadX] Connected to local AST CLI Sync Server');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'SYNC_ROUTES') {
          console.log('[PayloadX] Received route sync payload:', payload.data);
          setSyncDiff(payload.data);
          if (payload.data.newRoutes.length > 0 || payload.data.updatedRoutes.length > 0) {
            setHasNewSync(true);
          }
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleSyncRoutes = async (routesToSync, collectionId) => {
    if (!currentProject || !routesToSync.length) return;
    
    const loadingToast = toast.loading(`Importing ${routesToSync.length} routes...`);
    try {
      const promises = routesToSync.map(route => {
        return api.post('/api/request', {
          name: route.path,
          method: route.method,
          url: `{{baseUrl}}${route.path}`,
          collectionId: collectionId,
          projectId: currentProject._id,
          teamId: currentProject.teamId,
          description: `Auto-generated from ${route.handler} handler`,
          headers: [],
          params: [],
          body: { mode: 'none' },
          auth: { type: 'none' }
        });
      });
      
      await Promise.all(promises);
      toast.success(`Successfully imported ${routesToSync.length} routes!`, { id: loadingToast });
      setSyncDiff(null);
      setHasNewSync(false);
      setShowSyncSidebar(false);
    } catch (err) {
      console.error('Failed to sync routes', err);
      toast.error('Failed to import routes', { id: loadingToast });
    }
  };

  return (
    <div
      className="v2-app"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
    >
      {/* ── Top bar ── */}
      <TopBarV2
        sidebarOpen={sidebarV2Open}
        onToggleSidebar={toggleSidebarV2}
        orientation={workspaceOrientation}
        onToggleOrientation={toggleOrientation}
        hasSyncNotification={hasNewSync}
        onOpenSync={() => setShowSyncSidebar(true)}
      />

      {showSyncSidebar && (
        <SyncSidebar 
          diff={syncDiff}
          currentProject={currentProject}
          onClose={() => setShowSyncSidebar(false)}
          onSync={handleSyncRoutes}
        />
      )}

      {/* ── Body row ── */}
      <div
        className="v2-body"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
      >

        {/* Left sidebar (collapsible) */}
        {sidebarV2Open && (
          <>
            <SidebarV2
              key="sidebar-v2"
              onShowTeamModal={onShowTeamModal}
              onShowProjectModal={onShowProjectModal}
              onShowCollectionModal={onShowCollectionModal}
              onShowImportModal={onShowImportModal}
              onOpenEnvPanel={onOpenEnvPanel}
              width={sidebarWidth}
            />
            {/* Sidebar Drag Handle */}
            <div
              className="v2-drag-col"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startW = sidebarWidth;
                const onMove = (e) => setSidebarWidth(startW + (e.clientX - startX));
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
            />
          </>
        )}

        {/* Main workspace */}
        <div
          className="v2-workspace"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
        >

          {activeV2Nav === 'dashboard' ? (
            <Dashboard />
          ) : activeV2Nav === 'docs' ? (
            <ApiDocsPanel />
          ) : activeV2Nav === 'workflow' ? (
            <WorkflowBuilder />
          ) : activeV2Nav === 'history' ? (
            <HistoryPanel />
          ) : needsOnboarding ? (
            <EmptyState
              onShowTeamModal={onShowTeamModal}
              onShowProjectModal={onShowProjectModal}
            />
          ) : openTabs.length === 0 ? (
            <Dashboard />
          ) : (
            <>
              {/* Tab Bar Map */}
              <div className="flex bg-[color:var(--surface-1)] border-b border-[color:var(--surface-3)] overflow-x-auto scrollbar-hide h-[40px] shrink-0">
                {openTabs?.length > 0 ? (
                  openTabs.map((tab) => {
                    const isActive = activeTabId === tab.id;

                    // Method styling
                    let methodColor = 'text-[color:var(--text-muted)]';
                    let methodText = tab.request.protocol === 'ws' ? 'WS' : tab.request.protocol === 'socketio' ? 'SIO' : tab.request.method;
                    if (tab.request.protocol === 'http') {
                      if (methodText === 'GET') methodColor = 'text-green-500';
                      else if (methodText === 'POST') methodColor = 'text-blue-500';
                      else if (methodText === 'PUT') methodColor = 'text-yellow-500';
                      else if (methodText === 'DELETE') methodColor = 'text-red-500';
                      else if (methodText === 'PATCH') methodColor = 'text-gray-400';
                    }

                    return (
                      <div
                        key={tab.id}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            items: [
                              {
                                id: 'close',
                                label: 'Close Tab',
                                onClick: () => handleCloseTab(tab.id)
                              },
                              {
                                id: 'close-others',
                                label: 'Close Other Tabs',
                                onClick: () => closeOtherTabs(tab.id)
                              },
                              {
                                id: 'close-right',
                                label: 'Close Tabs to Right',
                                onClick: () => closeTabsToRight(tab.id)
                              },
                              {
                                id: 'close-left',
                                label: 'Close Tabs to Left',
                                onClick: () => closeTabsToLeft(tab.id)
                              },
                              { id: 'divider1', divider: true },
                              {
                                id: 'close-all',
                                label: 'Close All Tabs',
                                danger: true,
                                onClick: () => closeAllTabs()
                              }
                            ]
                          });
                        }}
                        onClick={(e) => {
                          if (e.button === 1) { // Middle click to close
                            e.preventDefault();
                            handleCloseTab(tab.id);
                          } else {
                            setActiveTabId(tab.id);
                          }
                        }}
                        className={`group/tab flex items-center gap-2 h-full min-w-[120px] max-w-[200px] px-3 border-r border-[color:var(--surface-3)] cursor-pointer select-none transition-all ${isActive
                          ? 'bg-[color:var(--surface-2)] text-[color:var(--text-primary)] relative after:absolute after:top-0 after:left-0 after:right-0 after:h-[2px] after:bg-[color:var(--accent)]'
                          : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-2)]'
                          }`}
                      >
                        <span className={`text-[10px] font-bold tracking-wider ${methodColor} shrink-0`}>
                          {methodText}
                        </span>
                        <span className="text-xs truncate flex-1 leading-none mr-2">
                          {tab.request.name || 'Untitled'}
                        </span>

                        {/* Postman-style: dirty → dot only; hover tab → X only (same for active + inactive). Named group avoids parent group-hover conflicts. */}
                        <div className="relative h-[14px] w-[14px] shrink-0">
                          {tab.isDirty ? (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute inset-0 flex items-center justify-center group-hover/tab:hidden"
                            >
                              <span className="h-[6px] w-[6px] rounded-full bg-[color:var(--accent)] shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" />
                            </span>
                          ) : null}
                          <button
                            type="button"
                            title="Close tab"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCloseTab(tab.id);
                            }}
                            className="absolute inset-0 hidden items-center justify-center rounded text-[color:var(--text-muted)] group-hover/tab:flex hover:bg-[color:var(--surface-3)] hover:text-[color:var(--text-primary)]"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex items-center h-full px-4 text-xs text-[color:var(--text-muted)] font-medium italic">
                    No APIs open
                  </div>
                )}
              </div>

              {/* ── VERTICAL SPLIT (side-by-side) ── */}
              {workspaceOrientation === 'vertical' ? (
                <div className="v2-split-row">
                  {currentRequest?.protocol === 'ws' ? (
                    <div className="v2-card" style={{ flex: 1, minWidth: 0 }}>
                      <WSRequestBuilder />
                    </div>
                  ) : currentRequest?.protocol === 'socketio' ? (
                    <div className="v2-card" style={{ flex: 1, minWidth: 0 }}>
                      <SIORequestBuilder />
                    </div>
                  ) : (
                    <>
                      {/* Request card */}
                      <div className="v2-card" style={{ width: `${splitPercent}%`, flexShrink: 0 }}>
                        <div className="v2-card-title">
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Request URL
                        </div>
                        <div className="v2-card-body">
                          <RequestBuilder />
                        </div>
                      </div>

                      {/* Drag handle */}
                      <div
                        className="v2-drag-col"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const container = e.currentTarget.parentElement;
                          const containerW = container.getBoundingClientRect().width;
                          const startX = e.clientX;
                          const startPct = splitPercent;
                          const onMove = (e) => {
                            const deltaPct = ((e.clientX - startX) / containerW) * 100;
                            setSplitPercent(Math.max(20, Math.min(80, startPct + deltaPct)));
                          };
                          const onUp = () => {
                            window.removeEventListener('mousemove', onMove);
                            window.removeEventListener('mouseup', onUp);
                          };
                          window.addEventListener('mousemove', onMove);
                          window.addEventListener('mouseup', onUp);
                        }}
                      />

                      {/* Response / Docs card */}
                      <div className="v2-card" style={{ flex: 1, minWidth: 0 }}>
                        <div className="v2-card-title flex items-center justify-between w-full" style={{ padding: 0, height: 35 }}>
                          <div className="flex h-full">
                            <button
                              onClick={() => setRightPanelTab('Response')}
                              className={`flex items-center gap-2 px-4 h-full border-b-[2px] transition-colors ${rightPanelTab === 'Response' ? 'border-accent text-tx-primary bg-surface-2' : 'border-transparent text-surface-500 hover:text-tx-secondary'}`}
                            >
                              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              Response
                            </button>
                            <button
                              onClick={() => setRightPanelTab('Documentation')}
                              className={`flex items-center gap-2 px-4 h-full border-b-[2px] transition-colors ${rightPanelTab === 'Documentation' ? 'border-accent text-tx-primary bg-surface-2' : 'border-transparent text-surface-500 hover:text-tx-secondary'}`}
                            >
                              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Docs
                            </button>
                          </div>
                        </div>
                        <div className="v2-card-body">
                          {rightPanelTab === 'Response' ? <ResponseViewer /> : <InlineDocViewer />}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* ── HORIZONTAL SPLIT (stacked) ── */
                <div className="v2-split-col">
                  {currentRequest?.protocol === 'ws' ? (
                    <div className="v2-card" style={{ flex: 1, minHeight: 0 }}>
                      <WSRequestBuilder />
                    </div>
                  ) : currentRequest?.protocol === 'socketio' ? (
                    <div className="v2-card" style={{ flex: 1, minHeight: 0 }}>
                      <SIORequestBuilder />
                    </div>
                  ) : (
                    <>
                      {/* Request card */}
                      <div className="v2-card v2-card-h-request">
                        <div className="v2-card-title">
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Request URL
                        </div>
                        <div className="v2-card-body">
                          <RequestBuilder />
                        </div>
                      </div>

                      {/* Drag handle */}
                      <div
                        className="v2-drag-row"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const startY = e.clientY;
                          const startH = responseHeight;
                          const onMove = (e) =>
                            setResponseHeight(Math.max(150, Math.min(600, startH + (startY - e.clientY))));
                          const onUp = () => {
                            window.removeEventListener('mousemove', onMove);
                            window.removeEventListener('mouseup', onUp);
                          };
                          window.addEventListener('mousemove', onMove);
                          window.addEventListener('mouseup', onUp);
                        }}
                      />

                      {/* Response / Docs card */}
                      <div className="v2-card" style={{ height: responseHeight, flexShrink: 0 }}>
                        <div className="v2-card-title flex items-center justify-between w-full" style={{ padding: 0, height: 35 }}>
                          <div className="flex h-full">
                            <button
                              onClick={() => setRightPanelTab('Response')}
                              className={`flex items-center gap-2 px-4 h-full border-b-[2px] transition-colors ${rightPanelTab === 'Response' ? 'border-accent text-tx-primary bg-surface-2' : 'border-transparent text-surface-500 hover:text-tx-secondary'}`}
                            >
                              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              Response
                            </button>
                            <button
                              onClick={() => setRightPanelTab('Documentation')}
                              className={`flex items-center gap-2 px-4 h-full border-b-[2px] transition-colors ${rightPanelTab === 'Documentation' ? 'border-accent text-tx-primary bg-surface-2' : 'border-transparent text-surface-500 hover:text-tx-secondary'}`}
                            >
                              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Docs
                            </button>
                          </div>
                        </div>
                        <div className="v2-card-body">
                          {rightPanelTab === 'Response' ? <ResponseViewer /> : <InlineDocViewer />}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Sidebar (VS Code style) */}
        <RightSidebar />
      </div>
    </div>
  );
}
