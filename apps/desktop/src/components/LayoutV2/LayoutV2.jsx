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
import ProfilePage from '@/components/Profile/ProfilePage';
import toast from 'react-hot-toast';
import SyncSidebar from '@/components/Sync/SyncSidebar';
import api from '@/lib/api';

const TAB_METHOD_STYLES = {
  GET:     { color: '#22C55E', bg: 'rgba(34,197,94,0.09)' },
  POST:    { color: '#58A6FF', bg: 'rgba(88,166,255,0.09)' },
  PUT:     { color: '#E3B341', bg: 'rgba(227,179,65,0.09)' },
  DELETE:  { color: '#F85149', bg: 'rgba(248,81,73,0.09)' },
  PATCH:   { color: '#A8A8A8', bg: 'rgba(168,168,168,0.07)' },
  HEAD:    { color: '#8B949E', bg: 'rgba(139,148,158,0.07)' },
  OPTIONS: { color: '#39C5CF', bg: 'rgba(57,197,207,0.09)' },
  WS:      { color: '#A78BFA', bg: 'rgba(167,139,250,0.09)' },
  SIO:     { color: '#FB923C', bg: 'rgba(251,146,60,0.09)' },
};

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
          // saveRequest accepts a tabId so background (non-active) dirty tabs
          // can be saved directly without switching to them first.
          const result = await saveRequest(id);
          if (result.success) closeTab(id);
          return result;
        },
        onDontSave: () => {
          closeTab(id);
        }
      });
    } else {
      closeTab(id);
    }
  };

  // Shared guard for bulk-close actions (Close All / Others / Left / Right):
  // if any tab about to be closed is dirty, prompt once before proceeding.
  const closeWithUnsavedGuard = (dirtyTabs, performClose) => {
    if (dirtyTabs.length === 0) {
      performClose();
      return;
    }
    setShowUnsavedModal(true, {
      requestName: dirtyTabs.length === 1
        ? (dirtyTabs[0].request.name || 'Untitled')
        : `${dirtyTabs.length} requests`,
      onSave: async () => {
        for (const t of dirtyTabs) {
          const result = await saveRequest(t.id);
          if (!result.success) return result;
        }
        performClose();
        return { success: true };
      },
      onDontSave: () => {
        performClose();
      }
    });
  };

  const handleCloseAllTabs = () => {
    closeWithUnsavedGuard(openTabs.filter(t => t.isDirty), closeAllTabs);
  };

  const handleCloseOtherTabs = (id) => {
    closeWithUnsavedGuard(
      openTabs.filter(t => t.id !== id && t.isDirty),
      () => closeOtherTabs(id)
    );
  };

  const handleCloseTabsToRight = (id) => {
    const index = openTabs.findIndex(t => t.id === id);
    const dirtyTabs = index >= 0 ? openTabs.slice(index + 1).filter(t => t.isDirty) : [];
    closeWithUnsavedGuard(dirtyTabs, () => closeTabsToRight(id));
  };

  const handleCloseTabsToLeft = (id) => {
    const index = openTabs.findIndex(t => t.id === id);
    const dirtyTabs = index > 0 ? openTabs.slice(0, index).filter(t => t.isDirty) : [];
    closeWithUnsavedGuard(dirtyTabs, () => closeTabsToLeft(id));
  };

  // Check if user needs onboarding (no teams or projects)
  const needsOnboarding = teams.length === 0 || projects.length === 0 || !currentProject;

  // Cmd/Ctrl+W (useKeyboardShortcuts.js) dispatches this instead of closing directly,
  // so the unsaved-changes guard above still applies to the keyboard shortcut.
  useEffect(() => {
    const onCloseTabShortcut = (e) => {
      const tabId = e.detail?.tabId;
      if (tabId) handleCloseTab(tabId);
    };
    window.addEventListener('close-tab-shortcut', onCloseTabShortcut);
    return () => window.removeEventListener('close-tab-shortcut', onCloseTabShortcut);
  }, [openTabs]);

  // Optional AST CLI sync — only connects when VITE_AST_CLI_WS is set
  // (e.g. ws://localhost:4040). Avoids console noise when the CLI isn't running.
  useEffect(() => {
    const astUrl = import.meta.env.VITE_AST_CLI_WS;
    if (!astUrl) return;

    let cancelled = false;
    let ws = null;

    // Delay past React Strict Mode remount so we don't open+close mid-handshake.
    const timer = setTimeout(() => {
      if (cancelled) return;
      try {
        ws = new WebSocket(astUrl);
      } catch {
        return;
      }

      ws.onopen = () => {
        if (import.meta.env.DEV) console.log('[PayloadX] Connected to AST CLI Sync Server');
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'SYNC_ROUTES') {
            setSyncDiff(payload.data);
            if (payload.data.newRoutes.length > 0 || payload.data.updatedRoutes.length > 0) {
              setHasNewSync(true);
            }
          }
        } catch (e) {
          if (import.meta.env.DEV) console.error('Failed to parse WS message', e);
        }
      };

      ws.onerror = () => {};
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (!ws) return;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN) ws.close();
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
          ) : activeV2Nav === 'profile' ? (
            <ProfilePage />
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
              {/* Tab Bar */}
              <div
                className="flex bg-[color:var(--bg-primary)] border-b border-[color:var(--border-1)] overflow-x-auto overflow-y-hidden shrink-0 h-9"
                style={{ scrollbarWidth: 'none' }}
              >
                {openTabs?.length > 0 ? (
                  openTabs.map((tab) => {
                    const isActive = activeTabId === tab.id;
                    const proto = tab.request.protocol;
                    const methodText = proto === 'ws' ? 'WS' : proto === 'socketio' ? 'SIO' : tab.request.method;
                    const mStyle = TAB_METHOD_STYLES[methodText] || { color: 'var(--text-muted)', bg: 'transparent' };

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
                                onClick: () => handleCloseOtherTabs(tab.id)
                              },
                              {
                                id: 'close-right',
                                label: 'Close Tabs to Right',
                                onClick: () => handleCloseTabsToRight(tab.id)
                              },
                              {
                                id: 'close-left',
                                label: 'Close Tabs to Left',
                                onClick: () => handleCloseTabsToLeft(tab.id)
                              },
                              { id: 'divider1', divider: true },
                              {
                                id: 'close-all',
                                label: 'Close All Tabs',
                                danger: true,
                                onClick: () => handleCloseAllTabs()
                              }
                            ]
                          });
                        }}
                        onMouseDown={(e) => {
                          // Middle-click closes the tab — must be onMouseDown,
                          // browsers don't fire a middle-button click event.
                          if (e.button === 1) {
                            e.preventDefault();
                            handleCloseTab(tab.id);
                          }
                        }}
                        onClick={(e) => {
                          if (e.button !== 1) {
                            setActiveTabId(tab.id);
                          }
                        }}
                        className={`group/tab relative flex items-center gap-2 h-full px-3 border-r border-[color:var(--border-1)] cursor-pointer select-none transition-colors duration-100 min-w-[130px] max-w-[200px] ${
                          isActive
                            ? 'bg-[color:var(--surface-1)] text-[color:var(--text-primary)]'
                            : 'bg-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-1)] hover:text-[color:var(--text-primary)]'
                        }`}
                      >
                        {/* Top accent line — active only */}
                        {isActive && (
                          <span className="absolute top-0 left-0 right-0 h-[1.5px] rounded-b" style={{ background: mStyle.color }} />
                        )}

                        {/* Method badge */}
                        <span
                          className="text-[9px] font-bold tracking-wider shrink-0 px-[5px] py-[2px] rounded font-mono"
                          style={{ color: mStyle.color, background: mStyle.bg }}
                        >
                          {methodText}
                        </span>

                        {/* Tab name */}
                        <span className="text-[11px] truncate flex-1 leading-none font-mono">
                          {tab.request.name || 'Untitled'}
                        </span>

                        {/* Dirty indicator / close button */}
                        <div className="relative h-[14px] w-[14px] shrink-0">
                          {tab.isDirty && (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute inset-0 flex items-center justify-center group-hover/tab:hidden"
                            >
                              <span
                                className="h-[5px] w-[5px] rounded-full"
                                style={{ background: mStyle.color }}
                              />
                            </span>
                          )}
                          <button
                            type="button"
                            title="Close tab"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCloseTab(tab.id);
                            }}
                            className="absolute inset-0 hidden items-center justify-center rounded text-[color:var(--text-muted)] group-hover/tab:flex hover:bg-[color:var(--surface-3)] hover:text-[color:var(--text-primary)]"
                          >
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex items-center h-full px-4 text-[11px] text-[color:var(--text-muted)] font-mono tracking-wide">
                    No open requests
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
                        <div className="v2-card-title flex items-center justify-between w-full" style={{ padding: 0, minHeight: 28 }}>
                          <div className="flex h-full">
                            <button
                              onClick={() => setRightPanelTab('Response')}
                              className={`flex items-center gap-1.5 px-2.5 h-full text-[11px] border-b-[2px] transition-colors ${rightPanelTab === 'Response' ? 'border-accent text-tx-primary' : 'border-transparent text-surface-500 hover:text-tx-secondary'}`}
                            >
                              Response
                            </button>
                            <button
                              onClick={() => setRightPanelTab('Documentation')}
                              className={`flex items-center gap-1.5 px-2.5 h-full text-[11px] border-b-[2px] transition-colors ${rightPanelTab === 'Documentation' ? 'border-accent text-tx-primary' : 'border-transparent text-surface-500 hover:text-tx-secondary'}`}
                            >
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
                        <div className="v2-card-title flex items-center justify-between w-full" style={{ padding: 0, minHeight: 28 }}>
                          <div className="flex h-full">
                            <button
                              onClick={() => setRightPanelTab('Response')}
                              className={`flex items-center gap-1.5 px-2.5 h-full text-[11px] border-b-[2px] transition-colors ${rightPanelTab === 'Response' ? 'border-accent text-tx-primary' : 'border-transparent text-surface-500 hover:text-tx-secondary'}`}
                            >
                              Response
                            </button>
                            <button
                              onClick={() => setRightPanelTab('Documentation')}
                              className={`flex items-center gap-1.5 px-2.5 h-full text-[11px] border-b-[2px] transition-colors ${rightPanelTab === 'Documentation' ? 'border-accent text-tx-primary' : 'border-transparent text-surface-500 hover:text-tx-secondary'}`}
                            >
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
