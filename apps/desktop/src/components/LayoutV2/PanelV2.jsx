import { useState, useRef } from 'react';
import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useRequestStore } from '@/store/requestStore';
import { useUIStore } from '@/store/uiStore';
import { getMethodClass } from '@/utils/helpers';

const METHOD_DOTS = {
  GET:     '#3FB950',
  POST:    '#58A6FF',
  PUT:     '#E3B341',
  PATCH:   '#A8A8A8',
  DELETE:  '#F85149',
  HEAD:    '#5A5A5A',
  OPTIONS: '#39C5CF',
};

function EnvironmentsPanel({ onOpenEnvPanel }) {
  return (
    <div className="p-4 animate-in">
      <div className="flex items-center justify-between mb-3">
        <span className="panel-section-label">Environments</span>
        <button
          onClick={onOpenEnvPanel}
          className="panel-add-btn"
          title="Manage environments"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
      <button
        onClick={onOpenEnvPanel}
        className="panel-empty-cta"
      >
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Open Environment Manager</span>
      </button>
    </div>
  );
}

function AnalyticsPanel() {
  return (
    <div className="p-4 animate-in">
      <span className="panel-section-label" style={{ display: 'block', marginBottom: 12 }}>Analytics</span>
      <div className="panel-empty-cta" style={{ cursor: 'default' }}>
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Analytics coming soon</span>
      </div>
    </div>
  );
}

function AIPanel() {
  return (
    <div className="p-4 animate-in">
      <span className="panel-section-label" style={{ display: 'block', marginBottom: 12 }}>AI Insights</span>
      <div className="panel-empty-cta" style={{ cursor: 'default' }}>
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>AI features coming soon</span>
      </div>
    </div>
  );
}

function DocsPanel() {
  return (
    <div className="p-4 animate-in">
      <span className="panel-section-label" style={{ display: 'block', marginBottom: 12 }}>Documentation</span>
      <div className="panel-empty-cta" style={{ cursor: 'default' }}>
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Documentation coming soon</span>
      </div>
    </div>
  );
}

function SettingsPanel() {
  const { theme, toggleTheme, toggleLayout } = useUIStore();
  return (
    <div className="p-4 animate-in">
      <span className="panel-section-label" style={{ display: 'block', marginBottom: 12 }}>Settings</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={toggleTheme}
          className="panel-settings-row"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {theme === 'dark'
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 3v1m0 16v1m8.66-10h-1M4.34 12H3m15.07-6.07l-.71.71M6.64 17.36l-.71.71M17.36 17.36l.71.71M6.64 6.64l.71-.71M12 8a4 4 0 100 8 4 4 0 000-8z" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            }
          </svg>
          <span>{theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}</span>
        </button>
        <button onClick={toggleLayout} className="panel-settings-row">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span>Switch to Classic Layout</span>
        </button>
      </div>
    </div>
  );
}

function CollectionsPanel({ onShowTeamModal, onShowProjectModal, onShowCollectionModal, onShowImportModal }) {
  const { teams, currentTeam, setCurrentTeam } = useTeamStore();
  const { projects, currentProject, setCurrentProject } = useProjectStore();
  const { collections, currentCollection, fetchCollectionRequests, requests } = useCollectionStore();
  const { setCurrentRequest } = useRequestStore();

  const [expandedCollections, setExpandedCollections] = useState(new Set());
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const toggleCollection = async (col) => {
    const id = col._id;
    if (expandedCollections.has(id)) {
      const next = new Set(expandedCollections);
      next.delete(id);
      setExpandedCollections(next);
    } else {
      setExpandedCollections(new Set([...expandedCollections, id]));
      await fetchCollectionRequests(id);
    }
  };

  const toggleFolder = (fid) => {
    const next = new Set(expandedFolders);
    next.has(fid) ? next.delete(fid) : next.add(fid);
    setExpandedFolders(next);
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
    <div className="flex flex-col h-full animate-in">
      {/* Search */}
      <div className="px-3 py-2 border-b border-[var(--border-1)]">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'var(--text-muted)' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            className="input pl-7 py-1 text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Teams */}
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="panel-section-label">Teams</span>
            <button onClick={onShowTeamModal} className="panel-add-btn" title="New team">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <div className="flex flex-col gap-0.5">
            {teams.map((team) => {
              const isActive = currentTeam?._id === team._id;
              return (
                <button
                  key={team._id}
                  onClick={() => setCurrentTeam(team)}
                  className={`panel-tree-row ${isActive ? 'panel-tree-row--active' : ''}`}
                >
                  <div className="panel-tree-avatar">{team.name[0].toUpperCase()}</div>
                  <span className="truncate flex-1">{team.name}</span>
                  {team.members?.length > 0 && (
                    <span className="panel-tree-badge">{team.members.length + 1}</span>
                  )}
                </button>
              );
            })}
            {teams.length === 0 && (
              <p className="text-[11px] px-1 py-1" style={{ color: 'var(--text-muted)' }}>No teams yet</p>
            )}
          </div>
        </div>

        {/* Projects */}
        {currentTeam && (
          <div className="px-3 pt-3 pb-1 border-t border-[var(--border-1)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="panel-section-label">Projects</span>
              <button onClick={onShowProjectModal} className="panel-add-btn" title="New project">
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              {projects.map((proj) => {
                const isActive = currentProject?._id === proj._id;
                return (
                  <button
                    key={proj._id}
                    onClick={() => setCurrentProject(proj)}
                    className={`panel-tree-row ${isActive ? 'panel-tree-row--active' : ''}`}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: proj.color || '#6366f1' }}
                    />
                    <span className="truncate flex-1">{proj.name}</span>
                  </button>
                );
              })}
              {projects.length === 0 && (
                <p className="text-[11px] px-1 py-1" style={{ color: 'var(--text-muted)' }}>No projects yet</p>
              )}
            </div>
          </div>
        )}

        {/* Collections */}
        <div className="px-3 pt-3 pb-3 border-t border-[var(--border-1)]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="panel-section-label">Collections</span>
            <div className="flex items-center gap-1">
              <button onClick={onShowImportModal} className="panel-add-btn" title="Import Postman collection">
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </button>
              <button onClick={onShowCollectionModal} className="panel-add-btn" title="New collection">
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            {collections.map((col) => {
              const isExp = expandedCollections.has(col._id);
              const colReqs = filteredRequests(col._id);
              return (
                <div key={col._id}>
                  <button
                    onClick={() => toggleCollection(col)}
                    className={`panel-tree-row ${currentCollection?._id === col._id ? 'panel-tree-row--active' : ''}`}
                  >
                    <svg
                      className={`w-2.5 h-2.5 flex-shrink-0 transition-transform duration-150 ${isExp ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <svg className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="truncate flex-1 text-left">{col.name}</span>
                    {col.isImported && (
                      <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'rgba(210,153,34,0.15)', color: 'var(--warning)' }}>
                        Postman
                      </span>
                    )}
                  </button>

                  {isExp && (
                    <div className="ml-3 pl-2 border-l border-[var(--border-1)] mt-0.5 flex flex-col gap-0.5 animate-in">
                      {col.folders?.map((folder) => {
                        const folderReqs = colReqs.filter((r) => r.folderId === folder.id);
                        const isFolderExp = expandedFolders.has(folder.id);
                        return (
                          <div key={folder.id}>
                            <button
                              onClick={() => toggleFolder(folder.id)}
                              className="panel-tree-row"
                            >
                              <svg className={`w-2 h-2 flex-shrink-0 transition-transform ${isFolderExp ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <svg className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--warning)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                              <span className="truncate flex-1 text-left">{folder.name}</span>
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{folderReqs.length}</span>
                            </button>
                            {isFolderExp && folderReqs.map((req) => (
                              <PanelRequestItem key={req._id} request={req} onSelect={setCurrentRequest} />
                            ))}
                          </div>
                        );
                      })}

                      {colReqs.filter((r) => !r.folderId).map((req) => (
                        <PanelRequestItem key={req._id} request={req} onSelect={setCurrentRequest} />
                      ))}

                      {colReqs.length === 0 && (
                        <p className="text-[11px] px-2 py-1 italic" style={{ color: 'var(--text-muted)' }}>No requests</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {collections.length === 0 && (
              <p className="text-[11px] px-1 py-1" style={{ color: 'var(--text-muted)' }}>No collections yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelRequestItem({ request, onSelect }) {
  const color = METHOD_DOTS[request.method] || '#9A9A9A';
  return (
    <button
      onClick={() => onSelect(request)}
      className="panel-tree-row group"
      style={{ paddingLeft: '8px' }}
    >
      <span
        className="text-[9px] font-bold font-mono flex-shrink-0 px-1.5 py-0.5 rounded"
        style={{
          color,
          background: `${color}18`,
          minWidth: 36,
          textAlign: 'center',
        }}
      >
        {request.method}
      </span>
      <span className="truncate flex-1 text-left" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
        {request.name}
      </span>
    </button>
  );
}

export default function PanelV2({ activePanel, onShowTeamModal, onShowProjectModal, onShowCollectionModal, onShowImportModal, onOpenEnvPanel }) {
  const panelRef = useRef(null);
  const [width, setWidth] = useState(240);

  const renderContent = () => {
    switch (activePanel) {
      case 'collections':
        return (
          <CollectionsPanel
            onShowTeamModal={onShowTeamModal}
            onShowProjectModal={onShowProjectModal}
            onShowCollectionModal={onShowCollectionModal}
            onShowImportModal={onShowImportModal}
          />
        );
      case 'environments':
        return <EnvironmentsPanel onOpenEnvPanel={onOpenEnvPanel} />;
      case 'analytics':
        return <AnalyticsPanel />;
      case 'ai':
        return <AIPanel />;
      case 'docs':
        return <DocsPanel />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return null;
    }
  };

  if (!activePanel) return null;

  return (
    <>
      {/* Panel */}
      <div
        ref={panelRef}
        className="flex flex-col h-full overflow-hidden flex-shrink-0"
        style={{
          width,
          background: 'var(--panel-bg)',
          borderRight: '1px solid var(--border-1)',
          transition: 'width 0.15s ease',
        }}
      >
        {/* Panel header */}
        <div
          className="flex items-center justify-between px-3 py-2.5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-1)' }}
        >
          <span className="text-xs font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
            {activePanel}
          </span>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-hidden">
          {renderContent()}
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="w-1 cursor-col-resize flex-shrink-0 relative group"
        style={{ background: 'var(--border-1)' }}
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startW = width;
          const onMove = (e) => setWidth(Math.max(180, Math.min(420, startW + (e.clientX - startX))));
          const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      >
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'var(--accent)' }}
        />
      </div>
    </>
  );
}
