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
    <div className="dash-container animate-in bg-[#060606]">
      {/* ── Header ── */}
      <header className="dash-header">
        <div className="dash-welcome">
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1.5">
            {greeting}, {user?.email?.split('@')[0] || 'User'}
          </h1>
          <p className="text-[13px] text-slate-500 font-medium uppercase tracking-[0.15em]">
            Overview of <span className="text-slate-300">{currentProject?.name || 'your project'}</span>
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
        <div className="dash-panel bg-[#0d0d0d] border-white/[0.05] rounded-xl overflow-hidden shadow-2xl">
          <div className="px-6 py-5 border-b border-white/[0.05] flex items-center justify-between">
            <h2 className="text-[11px] font-bold text-white uppercase tracking-[0.2em]">Recent Activity</h2>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
          </div>
          <div className="dash-list p-2">
            {history.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-[11px] text-slate-600 font-medium uppercase tracking-widest">No recent history</p>
              </div>
            ) : (
              history.slice(0, 5).map((entry, i) => (
                <button key={entry.id || i} onClick={() => handleRecentClick(entry)} className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-white/[0.02] transition-all group border-b border-white/[0.02] last:border-0">
                  <div className="w-10 h-10 rounded border border-white/5 bg-white/[0.01] flex items-center justify-center text-[9px] font-bold text-slate-400 group-hover:text-white transition-colors">
                    {entry.request.protocol === 'ws' ? 'WS' : entry.request.method}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors truncate">{entry.request.name}</p>
                    <p className="text-[10px] text-slate-600 font-mono truncate mt-0.5">{entry.request.url}</p>
                  </div>
                  <div className="text-[10px] text-slate-700 font-mono">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Quick Links ── */}
        <div className="dash-panel bg-[#0d0d0d] border-white/[0.05] rounded-xl overflow-hidden shadow-2xl">
          <div className="px-6 py-5 border-b border-white/[0.05]">
            <h2 className="text-[11px] font-bold text-white uppercase tracking-[0.2em]">Getting Started</h2>
          </div>
          <div className="p-4 grid grid-cols-1 gap-3">
            <QuickLink
              title="New Collection"
              desc="Group related APIs into workspaces"
              onClick={() => document.querySelector('[title="New collection"]')?.click()}
            />
            <QuickLink
              title="Import Data"
              desc="Migrate from Postman or Insomnia"
              onClick={() => document.querySelector('[title="Import"]')?.click()}
            />
            <QuickLink
              title="Environment Vars"
              desc="Manage project-wide variables"
              onClick={() => document.querySelector('[title="Environments"]')?.click()}
            />
          </div>
        </div>
      </div>

      {/* Attribution Footer */}
      <div className="mt-auto py-8 text-center opacity-30">
        <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-medium">
          PayloadX Engine &copy; 2026 &nbsp;·&nbsp; Created by <span className="text-slate-300">Sundan Sharma</span>
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, subValue, icon }) {
  return (
    <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl p-6 flex items-center gap-5 group hover:border-white/[0.15] transition-all shadow-xl">
      <div className="w-12 h-12 rounded-lg border border-white/5 bg-white/[0.02] flex items-center justify-center text-slate-500 group-hover:text-white transition-colors">
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {icon}
        </svg>
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-white tracking-tight">{value}</span>
          {subValue && <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{subValue}</span>}
        </div>
        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1">{label}</p>
      </div>
    </div>
  );
}

function QuickLink({ title, desc, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col gap-1 p-4 rounded-lg bg-white/[0.01] border border-white/[0.03] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all group text-left">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{title}</span>
        <svg className="w-3 h-3 text-slate-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <p className="text-[11px] text-slate-600 leading-relaxed">{desc}</p>
    </button>
  );
}
