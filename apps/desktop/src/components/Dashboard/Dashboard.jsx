import React, { useMemo } from 'react';
import { useCollectionStore } from '@/store/collectionStore';
import { useRequestStore } from '@/store/requestStore';
import { useWSStore } from '@/store/wsStore';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { user } = useAuthStore();
  const { collections, requests, setCurrentCollection } = useCollectionStore();
  const { history, setCurrentRequest, newRequest } = useRequestStore();
  const { connections } = useWSStore();
  const { currentProject } = useProjectStore();

  const stats = useMemo(() => {
    const projectCollections = collections.filter(c => c.projectId === currentProject?._id);
    const collectionIds = new Set(projectCollections.map(c => c._id));
    const projectRequests = requests.filter(r => collectionIds.has(r.collectionId));

    const wsCount = projectRequests.filter(r => r.protocol === 'ws').length;
    const restCount = projectRequests.filter(r => r.protocol !== 'ws').length;
    const activeWS = Object.keys(connections).filter(id => {
      const req = projectRequests.find(r => r._id === id);
      return req && req.protocol === 'ws';
    }).length;

    return {
      collections: projectCollections.length,
      rest: restCount,
      ws: wsCount,
      activeWS
    };
  }, [collections, requests, currentProject?._id, connections]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const { setActiveV2Nav, setShowImportModal } = useUIStore();

  const handleRecentClick = (entry) => {
    // Set request
    setCurrentRequest(entry.request);

    // Set parent collection so breadcrumbs/sidebar stay in sync
    const parentCol = collections.find(c => c._id === entry.request.collectionId);
    if (parentCol) {
      setCurrentCollection(parentCol);
    }

    // Switch view to Workspace
    setActiveV2Nav('collections');

    toast.success(`Opened ${entry.request.name}`);
  };

  return (
    <div className="dash-container animate-in bg-[var(--bg-primary)]">
      {/* ── Header ── */}
      <header className="dash-header">
        <div className="dash-welcome">
          <h1 className="text-xl font-extrabold text-tx-primary tracking-tight mb-1">
            {greeting}, {user?.email?.split('@')[0] || 'User'}
          </h1>
          <p className="text-[13px] text-surface-500 font-medium uppercase tracking-[0.15em]">
            Overview of <span className="text-tx-secondary">{currentProject?.name || 'your project'}</span>
          </p>
        </div>
      </header>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="Collections"
          value={stats.collections}
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />}
        />
        <StatCard
          label="REST APIs"
          value={stats.rest}
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />}
        />
        <StatCard
          label="Active Streams"
          value={stats.ws}
          subValue={stats.activeWS > 0 ? `${stats.activeWS} connected` : null}
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />}
        />
      </div>

      <div className="dash-lower-grid">
        {/* ── Recent Activity ── */}
        <div className="dash-panel overflow-hidden">
          <div className="dash-panel-header">
            <h2 className="text-[10px] font-bold text-tx-muted uppercase tracking-[0.15em]">Recent Activity</h2>
          </div>
          <div className="dash-list p-1">
            {history.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[10px] text-surface-500 font-medium uppercase tracking-widest">No recent history</p>
              </div>
            ) : (
              history.slice(0, 5).map((entry, i) => (
                <button key={entry.id || i} onClick={() => handleRecentClick(entry)} className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-[var(--surface-2)] transition-all group border-b border-[var(--border-1)] last:border-0">
                  <div className="w-8 h-8 rounded border border-[var(--border-2)] bg-[var(--surface-3)] flex items-center justify-center text-[9px] font-bold text-surface-400 group-hover:text-tx-primary transition-colors shrink-0">
                    {entry.request.protocol === 'ws' ? 'WS' : entry.request.method}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-bold text-tx-secondary group-hover:text-tx-primary transition-colors truncate">{entry.request.name}</p>
                    <p className="text-[10px] text-surface-500 font-mono truncate mt-0.5">{entry.request.url}</p>
                  </div>
                  <div className="text-[10px] text-surface-400 font-mono">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Getting Started ── */}
        <div className="dash-panel overflow-hidden flex flex-col">
          <div className="dash-panel-header">
            <h2 className="text-[10px] font-bold text-tx-muted uppercase tracking-[0.15em]">Getting Started</h2>
          </div>
          <div className="p-3 grid grid-cols-1 gap-2">
            <QuickLink
              title="New Collection"
              desc="Group related APIs into workspaces"
              onClick={() => setActiveV2Nav('collections')}
            />
            <QuickLink
              title="Import Data"
              desc="Migrate from Postman or Insomnia"
              onClick={() => setShowImportModal(true)}
            />
            <QuickLink
              title="Environment Vars"
              desc="Manage project-wide variables"
              onClick={() => useUIStore.setState({ showEnvironmentPanel: true })}
            />
          </div>
        </div>
      </div>

      {/* Attribution Footer */}
      <div className="mt-auto py-3 text-center opacity-40 shrink-0">
        <p className="text-[10px] text-surface-500 uppercase tracking-[0.3em] font-medium">
          PayloadX Engine &copy; 2026 &nbsp;·&nbsp; Created by <span className="text-tx-secondary">Sundan Sharma</span>
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, subValue, icon }) {
  return (
    <div className="bg-[var(--surface-1)] border border-[var(--border-1)] rounded-lg p-4 flex items-center gap-3 group hover:border-[var(--border-2)] transition-colors">
      <div className="w-10 h-10 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] flex items-center justify-center text-tx-muted group-hover:text-tx-secondary transition-colors shrink-0">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {icon}
        </svg>
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-tx-primary tracking-tight">{value}</span>
          {subValue && (
            <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              {subValue}
            </span>
          )}
        </div>
        <p className="text-[9px] text-tx-muted font-bold uppercase tracking-[0.15em] mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function QuickLink({ title, desc, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col gap-0.5 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-1)] hover:bg-[var(--surface-3)] hover:border-[var(--border-2)] transition-all group text-left">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-tx-secondary group-hover:text-tx-primary transition-colors uppercase tracking-wide">{title}</span>
        <svg className="w-3 h-3 text-tx-muted group-hover:text-tx-secondary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <p className="text-[10px] text-tx-muted leading-snug">{desc}</p>
    </button>
  );
}
