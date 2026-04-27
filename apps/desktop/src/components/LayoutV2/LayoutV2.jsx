import { useState } from 'react';
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

  const { teams, currentTeam } = useTeamStore();
  const { projects, currentProject } = useProjectStore();
  const { currentCollection } = useCollectionStore();
  const { currentRequest, openTabs, activeTabId, setActiveTabId, closeTab, closeAllTabs, closeOtherTabs, closeTabsToLeft, closeTabsToRight } = useRequestStore();

  // Check if user needs onboarding (no teams or projects)
  const needsOnboarding = teams.length === 0 || projects.length === 0 || !currentProject;

  // Split percentage for vertical mode — default 50/50
  const [splitPercent, setSplitPercent] = useState(50);

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
      />

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
          ) : needsOnboarding ? (
            <EmptyState
              onShowTeamModal={onShowTeamModal}
              onShowProjectModal={onShowProjectModal}
            />
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
                                onClick: () => closeTab(tab.id)
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
                            closeTab(tab.id);
                          } else {
                            setActiveTabId(tab.id);
                          }
                        }}
                        className={`group flex items-center gap-2 h-full min-w-[120px] max-w-[200px] px-3 border-r border-[color:var(--surface-3)] cursor-pointer select-none transition-all ${isActive
                            ? 'bg-[color:var(--surface-2)] text-[color:var(--text-primary)] relative after:absolute after:top-0 after:left-0 after:right-0 after:h-[2px] after:bg-[color:var(--accent)]'
                            : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-2)] opacity-80'
                          }`}
                      >
                        <span className={`text-[10px] font-bold tracking-wider ${methodColor} shrink-0`}>
                          {methodText}
                        </span>
                        <span className="text-xs truncate flex-1 leading-none mr-2">
                          {tab.request.name || 'Untitled'}
                        </span>

                        {/* Dot / Close Icon Container */}
                        <div className="w-[14px] h-[14px] flex items-center justify-center shrink-0">
                          {tab.isDirty && (
                            <div className={`w-[6px] h-[6px] rounded-full bg-[color:var(--accent)] ${isActive ? 'group-hover:hidden' : ''}`} />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeTab(tab.id);
                            }}
                            className={`w-[14px] h-[14px] rounded hover:bg-[color:var(--surface-3)] flex items-center justify-center text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition-colors ${tab.isDirty ? 'hidden group-hover:flex' : 'opacity-0 group-hover:opacity-100'
                              } ${isActive && !tab.isDirty ? 'opacity-100' : ''}`}
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
