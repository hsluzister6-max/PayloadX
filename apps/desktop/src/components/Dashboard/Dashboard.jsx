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

  const { setActiveV2Nav } = useUIStore();

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
          <h1 className="text-3xl font-extrabold text-tx-primary tracking-tight mb-1.5">
            {greeting}, {user?.email?.split('@')[0] || 'User'}
          </h1>
          <p className="text-[13px] text-surface-500 font-medium uppercase tracking-[0.15em]">
            Overview of <span className="text-tx-secondary">{currentProject?.name || 'your project'}</span>
          </p>
        </div>
      </header>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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

      <div className="dash-lower-grid gap-8">
        {/* ── Recent Activity ── */}
        <div className="dash-panel bg-[#0b0d13]/40 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/5">
            <h2 className="text-[11px] font-bold bg-gradient-to-r from-surface-400 to-surface-600 bg-clip-text text-transparent uppercase tracking-[0.2em]">Recent Activity</h2>
            <div className="w-1.5 h-1.5 rounded-full bg-surface-500"></div>
          </div>
          <div className="dash-list p-2">
            {history.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-[11px] text-surface-500 font-medium uppercase tracking-widest">No recent history</p>
              </div>
            ) : (
              history.slice(0, 5).map((entry, i) => (
                <button key={entry.id || i} onClick={() => handleRecentClick(entry)} className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-[var(--surface-2)] transition-all group border-b border-[var(--border-1)] last:border-0">
                  <div className="w-10 h-10 rounded border border-[var(--border-2)] bg-[var(--surface-3)] flex items-center justify-center text-[9px] font-bold text-surface-400 group-hover:text-tx-primary transition-colors">
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
        <div className="dash-panel bg-[#0b0d13]/40 border border-white/5 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/5">
            <h2 className="text-[11px] font-bold bg-gradient-to-r from-surface-400 to-surface-600 bg-clip-text text-transparent uppercase tracking-[0.2em]">Getting Started</h2>
          </div>
          <div className="p-6 grid grid-cols-1 gap-4">
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
      <div className="mt-auto py-8 text-center opacity-40">
        <p className="text-[10px] text-surface-500 uppercase tracking-[0.3em] font-medium">
          PayloadX Engine &copy; 2026 &nbsp;·&nbsp; Created by <span className="text-tx-secondary">Sundan Sharma</span>
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, subValue, icon }) {
  return (
    <div className="bg-[#0b0d13]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-6 flex items-center gap-5 group hover:bg-[#0b0d13]/80 transition-all shadow-2xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative z-10 w-14 h-14 rounded-xl border border-white/5 bg-gradient-to-br from-surface-800 to-surface-950 flex items-center justify-center text-surface-500 group-hover:text-gray-300 transition-all duration-300 shadow-inner group-hover:scale-105">
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {icon}
        </svg>
      </div>
      <div className="relative z-10">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black bg-gradient-to-r from-gray-100 via-gray-300 to-gray-500 bg-clip-text text-transparent tracking-tighter">{value}</span>
          {subValue && (
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-400/5 px-2 py-0.5 rounded border border-emerald-400/10">
              {subValue}
            </span>
          )}
        </div>
        <p className="text-[10px] text-surface-500 font-bold uppercase tracking-[0.2em] mt-2 group-hover:text-surface-400 transition-colors">{label}</p>
      </div>
    </div>
  );
}

function QuickLink({ title, desc, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col gap-1 p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group text-left shadow-inner">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold bg-gradient-to-r from-surface-300 to-surface-500 bg-clip-text text-transparent group-hover:from-gray-100 group-hover:to-gray-300 transition-all uppercase tracking-wide">{title}</span>
        <svg className="w-3.5 h-3.5 text-surface-500 group-hover:text-gray-200 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <p className="text-[10px] text-surface-500 leading-relaxed font-medium mt-1">{desc}</p>
    </button>
  );
}
