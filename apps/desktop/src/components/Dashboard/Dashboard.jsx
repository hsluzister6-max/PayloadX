import React, { useEffect, useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO, startOfDay, subDays, isValid } from 'date-fns';
import { useCollectionStore } from '@/store/collectionStore';
import { useRequestStore } from '@/store/requestStore';
import { useWSStore } from '@/store/wsStore';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore } from '@/store/projectStore';
import { useTeamStore } from '@/store/teamStore';
import { useUIStore } from '@/store/uiStore';
import { useDashboardStore } from '@/store/dashboardStore';
import toast from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';

const METHOD_COLORS = {
  GET: '#3FB950',
  POST: '#58A6FF',
  PUT: '#E3B341',
  PATCH: '#A8A8A8',
  DELETE: '#F85149',
  HEAD: '#8B949E',
  OPTIONS: '#39C5CF',
  WS: '#38BDF8',
  SOCKETIO: '#A78BFA',
  OTHER: '#6E7681',
};

const CHART_ACCENT = '#3B82F6';
const CHART_GRID = 'rgba(128,128,128,0.18)';
const CHART_AXIS = 'rgba(160,160,160,0.85)';

function parseDate(value) {
  if (!value) return null;
  const d = typeof value === 'string' ? parseISO(value) : new Date(value);
  return isValid(d) ? d : null;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-chart-tooltip">
      {label != null && <p className="dash-chart-tooltip__label">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.dataKey || entry.name} className="dash-chart-tooltip__row">
          <span style={{ color: entry.color || CHART_ACCENT }}>{entry.name}</span>
          <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
}

function buildLocalAnalytics({ projectCollections, projectRequests, history, connections }) {
  const collectionNameById = Object.fromEntries(projectCollections.map((c) => [c._id, c.name]));
  const wsCount = projectRequests.filter((r) => r.protocol === 'ws' || r.protocol === 'socketio').length;
  const restCount = projectRequests.length - wsCount;
  const activeWS = Object.keys(connections || {}).filter((id) => {
    const req = projectRequests.find((r) => r._id === id);
    return req && (req.protocol === 'ws' || req.protocol === 'socketio');
  }).length;

  const successRuns = (history || []).filter((h) => {
    const status = h.response?.status;
    return status >= 200 && status < 400;
  }).length;

  const days = 14;
  const createdBuckets = [];
  const today = startOfDay(new Date());
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = subDays(today, i);
    createdBuckets.push({
      key: format(day, 'yyyy-MM-dd'),
      label: format(day, 'MMM d'),
      created: 0,
    });
  }
  const createdIndex = Object.fromEntries(createdBuckets.map((b, i) => [b.key, i]));
  projectRequests.forEach((req) => {
    const d = parseDate(req.createdAt) || parseDate(req.updatedAt);
    if (!d) return;
    const key = format(startOfDay(d), 'yyyy-MM-dd');
    if (createdIndex[key] != null) createdBuckets[createdIndex[key]].created += 1;
  });

  const methodCounts = {};
  projectRequests.forEach((req) => {
    let key = (req.method || 'GET').toUpperCase();
    if (req.protocol === 'ws') key = 'WS';
    if (req.protocol === 'socketio') key = 'SOCKETIO';
    methodCounts[key] = (methodCounts[key] || 0) + 1;
  });

  const collectionCounts = {};
  projectRequests.forEach((req) => {
    const name = collectionNameById[req.collectionId] || 'Uncategorized';
    collectionCounts[name] = (collectionCounts[name] || 0) + 1;
  });

  const runDays = 7;
  const runBuckets = [];
  for (let i = runDays - 1; i >= 0; i -= 1) {
    const day = subDays(today, i);
    runBuckets.push({
      key: format(day, 'yyyy-MM-dd'),
      label: format(day, 'EEE'),
      runs: 0,
      avgMs: 0,
      _totalMs: 0,
    });
  }
  const runIndex = Object.fromEntries(runBuckets.map((b, i) => [b.key, i]));
  (history || []).forEach((entry) => {
    const d = parseDate(entry.timestamp);
    if (!d) return;
    const key = format(startOfDay(d), 'yyyy-MM-dd');
    const idx = runIndex[key];
    if (idx == null) return;
    runBuckets[idx].runs += 1;
    const ms = entry.response?.responseTimeMs;
    if (typeof ms === 'number') runBuckets[idx]._totalMs += ms;
  });

  return {
    stats: {
      collections: projectCollections.length,
      totalApis: projectRequests.length,
      rest: restCount,
      ws: wsCount,
      activeWS,
      runs: (history || []).length,
      successRate: history?.length ? Math.round((successRuns / history.length) * 100) : 0,
    },
    createdOverTime: createdBuckets,
    methodDistribution: Object.entries(methodCounts)
      .map(([name, value]) => ({ name, value, color: METHOD_COLORS[name] || METHOD_COLORS.OTHER }))
      .sort((a, b) => b.value - a.value),
    collectionBreakdown: Object.entries(collectionCounts)
      .map(([name, apis]) => ({
        name: name.length > 16 ? `${name.slice(0, 16)}…` : name,
        apis,
        fullName: name,
      }))
      .sort((a, b) => b.apis - a.apis)
      .slice(0, 8),
    runAnalytics: runBuckets.map((b) => ({
      label: b.label,
      runs: b.runs,
      avgMs: b.runs ? Math.round(b._totalMs / b.runs) : 0,
    })),
    recentlyCreated: projectRequests
      .slice()
      .sort((a, b) => {
        const da = parseDate(a.createdAt) || parseDate(a.updatedAt) || new Date(0);
        const db = parseDate(b.createdAt) || parseDate(b.updatedAt) || new Date(0);
        return db - da;
      })
      .slice(0, 8),
    recentRuns: (history || []).slice(0, 6).map((entry) => ({
      _id: entry.id,
      name: entry.request?.name,
      method: entry.request?.method,
      protocol: entry.request?.protocol,
      url: entry.request?.url,
      status: entry.response?.status,
      responseTimeMs: entry.response?.responseTimeMs,
      createdAt: entry.timestamp,
      request: entry.request,
      _fromHistory: true,
    })),
    source: 'local',
  };
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const { collections, requests, setCurrentCollection } = useCollectionStore();
  const { history, setCurrentRequest } = useRequestStore();
  const { connections } = useWSStore();
  const { currentProject } = useProjectStore();
  const { currentTeam } = useTeamStore();
  const { setActiveV2Nav, setShowImportModal, openRightSidebarTab } = useUIStore();
  const { data: remote, isLoading, error, fetchDashboard } = useDashboardStore();

  useEffect(() => {
    if (currentTeam?._id) {
      fetchDashboard(currentTeam._id, currentProject?._id);
    }
  }, [currentTeam?._id, currentProject?._id, fetchDashboard]);

  const localProject = useMemo(() => {
    const projectCollections = collections.filter((c) => c.projectId === currentProject?._id);
    const collectionIds = new Set(projectCollections.map((c) => c._id));
    const projectRequests = requests.filter((r) => collectionIds.has(r.collectionId));
    return { projectCollections, projectRequests };
  }, [collections, requests, currentProject?._id]);

  const localAnalytics = useMemo(
    () =>
      buildLocalAnalytics({
        projectCollections: localProject.projectCollections,
        projectRequests: localProject.projectRequests,
        history,
        connections,
      }),
    [localProject, history, connections]
  );

  const analytics = useMemo(() => {
    if (!remote) return localAnalytics;

    const methodDistribution = (remote.methodDistribution || []).map((m) => ({
      ...m,
      color: METHOD_COLORS[m.name] || METHOD_COLORS.OTHER,
    }));

    const collectionBreakdown = (remote.collectionBreakdown || []).map((c) => ({
      ...c,
      fullName: c.name,
      name: c.name?.length > 16 ? `${c.name.slice(0, 16)}…` : c.name,
    }));

    return {
      stats: {
        ...remote.stats,
        activeWS: localAnalytics.stats.activeWS,
      },
      createdOverTime: remote.createdOverTime || [],
      methodDistribution,
      collectionBreakdown,
      runAnalytics: remote.runAnalytics || [],
      recentlyCreated: remote.recentlyCreated || [],
      recentRuns: (remote.recentRuns || []).map((r) => ({ ...r, _fromHistory: false })),
      source: 'server',
      generatedAt: remote.generatedAt,
    };
  }, [remote, localAnalytics]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const openRequest = (request, sourceLabel) => {
    if (!request) return;
    setCurrentRequest(request);
    const parentCol = collections.find((c) => c._id === request.collectionId);
    if (parentCol) setCurrentCollection(parentCol);
    setActiveV2Nav('collections');
    toast.success(`Opened ${request.name || sourceLabel || 'request'}`);
  };

  const handleRefresh = () => {
    if (!currentTeam?._id) {
      toast.error('Select a team first');
      return;
    }
    fetchDashboard(currentTeam._id, currentProject?._id, { force: true });
  };

  const { stats, createdOverTime, methodDistribution, collectionBreakdown, runAnalytics, recentlyCreated, recentRuns } =
    analytics;

  return (
    <div className="dash-container animate-in bg-[var(--bg-primary)]">
      <header className="dash-header">
        <div className="dash-welcome">
          <h1 className="text-xl font-extrabold text-tx-primary tracking-tight mb-1">
            {greeting}, {user?.email?.split('@')[0] || 'User'}
          </h1>
          <p className="text-[13px] text-surface-500 font-medium uppercase tracking-[0.15em]">
            Analytics for <span className="text-tx-secondary">{currentProject?.name || 'your project'}</span>
            {analytics.source === 'server' ? (
              <span className="ml-2 text-[9px] tracking-widest text-emerald-500/90 normal-case">· live</span>
            ) : (
              <span className="ml-2 text-[9px] tracking-widest text-amber-500/90 normal-case">· local</span>
            )}
          </p>
          {error && analytics.source === 'local' && (
            <p className="text-[11px] text-amber-500/90 mt-1">{error}</p>
          )}
        </div>
        <div className="dash-header-actions">
          <button
            type="button"
            className="dash-cta dash-cta--ghost"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh analytics"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin inline mr-1' : 'inline mr-1'} />
            Refresh
          </button>
          <button type="button" className="dash-cta dash-cta--ghost" onClick={() => setActiveV2Nav('collections')}>
            Collections
          </button>
          <button type="button" className="dash-cta dash-cta--primary" onClick={() => setShowImportModal(true)}>
            Import
          </button>
        </div>
      </header>

      <div className="dash-stats-grid">
        <StatCard
          label="Collections"
          value={stats.collections}
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />}
        />
        <StatCard
          label="Saved APIs"
          value={stats.totalApis}
          subValue={stats.rest ? `${stats.rest} REST` : null}
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />}
        />
        <StatCard
          label="Streams"
          value={stats.ws}
          subValue={stats.activeWS > 0 ? `${stats.activeWS} live` : null}
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />}
        />
        <StatCard
          label="API Runs"
          value={stats.runs}
          subValue={stats.runs ? `${stats.successRate}% OK` : null}
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />}
        />
      </div>

      <div className="dash-charts-grid">
        <div className="dash-panel dash-panel--chart">
          <div className="dash-panel-header">
            <h2 className="dash-panel-kicker">APIs Created</h2>
            <span className="dash-panel-meta">Last 14 days</span>
          </div>
          <div className="dash-chart-body">
            {stats.totalApis === 0 ? (
              <EmptyChart note="Create or import APIs to see growth" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={createdOverTime} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashCreatedFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_ACCENT} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART_ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: CHART_AXIS, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: CHART_AXIS, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="created" name="Created" stroke={CHART_ACCENT} fill="url(#dashCreatedFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="dash-panel dash-panel--chart">
          <div className="dash-panel-header">
            <h2 className="dash-panel-kicker">Methods</h2>
            <span className="dash-panel-meta">Saved APIs</span>
          </div>
          <div className="dash-chart-body dash-chart-body--split">
            {methodDistribution.length === 0 ? (
              <EmptyChart note="No method data yet" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={methodDistribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                      {methodDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="dash-method-legend">
                  {methodDistribution.map((m) => (
                    <li key={m.name}>
                      <span className="dash-method-dot" style={{ background: m.color }} />
                      <span className="dash-method-name">{m.name}</span>
                      <span className="dash-method-count">{m.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="dash-charts-grid dash-charts-grid--secondary">
        <div className="dash-panel dash-panel--chart">
          <div className="dash-panel-header">
            <h2 className="dash-panel-kicker">APIs by Collection</h2>
            <span className="dash-panel-meta">Top collections</span>
          </div>
          <div className="dash-chart-body">
            {collectionBreakdown.length === 0 ? (
              <EmptyChart note="Collections will appear here" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={collectionBreakdown} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_GRID} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: CHART_AXIS, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={88} tick={{ fill: CHART_AXIS, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="apis" name="APIs" fill={CHART_ACCENT} radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="dash-panel dash-panel--chart">
          <div className="dash-panel-header">
            <h2 className="dash-panel-kicker">Run Activity</h2>
            <span className="dash-panel-meta">Last 7 days</span>
          </div>
          <div className="dash-chart-body">
            {stats.runs === 0 ? (
              <EmptyChart note="Send requests to track runs & latency" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={runAnalytics} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: CHART_AXIS, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: CHART_AXIS, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="runs" name="Runs" fill="#22C55E" radius={[4, 4, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="dash-lower-grid">
        <div className="dash-panel overflow-hidden">
          <div className="dash-panel-header">
            <h2 className="dash-panel-kicker">Recently Created APIs</h2>
            <button type="button" className="dash-panel-link" onClick={() => setActiveV2Nav('collections')}>
              View all
            </button>
          </div>
          <div className="dash-list p-1">
            {recentlyCreated.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[10px] text-surface-500 font-medium uppercase tracking-widest">No APIs yet</p>
              </div>
            ) : (
              recentlyCreated.map((req) => {
                const method = req.protocol === 'ws' ? 'WS' : req.protocol === 'socketio' ? 'SIO' : (req.method || 'GET');
                const when = parseDate(req.createdAt) || parseDate(req.updatedAt);
                return (
                  <button
                    key={req._id}
                    type="button"
                    onClick={() => openRequest(req)}
                    className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-[var(--surface-2)] transition-all group border-b border-[var(--border-1)] last:border-0"
                  >
                    <div
                      className="w-10 h-7 rounded border border-[var(--border-2)] bg-[var(--surface-3)] flex items-center justify-center text-[9px] font-bold shrink-0"
                      style={{ color: METHOD_COLORS[method] || METHOD_COLORS.OTHER }}
                    >
                      {method}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-xs font-bold text-tx-secondary group-hover:text-tx-primary transition-colors truncate">
                        {req.name || 'Untitled'}
                      </p>
                      <p className="text-[10px] text-surface-500 font-mono truncate mt-0.5">{req.url || '—'}</p>
                    </div>
                    <div className="text-[10px] text-surface-400 font-mono shrink-0">
                      {when ? format(when, 'MMM d') : '—'}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="dash-panel overflow-hidden flex flex-col">
          <div className="dash-panel-header">
            <h2 className="dash-panel-kicker">Recent Runs</h2>
            <button type="button" className="dash-panel-link" onClick={() => setActiveV2Nav('history')}>
              History
            </button>
          </div>
          <div className="dash-list p-1 flex-1">
            {recentRuns.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[10px] text-surface-500 font-medium uppercase tracking-widest">No recent runs</p>
              </div>
            ) : (
              recentRuns.map((entry, i) => {
                const method = entry.protocol === 'ws' ? 'WS' : entry.method;
                const when = parseDate(entry.createdAt) || (entry.createdAt ? new Date(entry.createdAt) : null);
                return (
                  <button
                    key={entry._id || i}
                    type="button"
                    onClick={() => {
                      if (entry._fromHistory && entry.request) openRequest(entry.request);
                      else if (entry.requestId) {
                        const req = requests.find((r) => r._id === entry.requestId);
                        if (req) openRequest(req, entry.name);
                        else toast(entry.name || 'Run recorded');
                      }
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-[var(--surface-2)] transition-all group border-b border-[var(--border-1)] last:border-0"
                  >
                    <div className="w-8 h-8 rounded border border-[var(--border-2)] bg-[var(--surface-3)] flex items-center justify-center text-[9px] font-bold text-surface-400 group-hover:text-tx-primary transition-colors shrink-0">
                      {method || 'GET'}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-xs font-bold text-tx-secondary group-hover:text-tx-primary transition-colors truncate">
                        {entry.name || 'Untitled'}
                      </p>
                      <p className="text-[10px] text-surface-500 font-mono truncate mt-0.5">
                        {entry.status != null ? `${entry.status}` : '—'}
                        {entry.responseTimeMs != null ? ` · ${entry.responseTimeMs}ms` : ''}
                      </p>
                    </div>
                    <div className="text-[10px] text-surface-400 font-mono">
                      {when ? when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="p-3 grid grid-cols-1 gap-2 border-t border-[var(--border-1)]">
            <QuickLink
              title="New Collection"
              desc="Group related APIs into workspaces"
              onClick={() => setActiveV2Nav('collections')}
            />
            <QuickLink
              title="Environment Vars"
              desc="Manage project-wide variables"
              onClick={() => {
                if (typeof openRightSidebarTab === 'function') openRightSidebarTab('environment');
                else useUIStore.setState({ showEnvironmentPanel: true, rightSidebarOpen: true });
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-auto py-3 text-center opacity-40 shrink-0">
        <p className="text-[10px] text-surface-500 uppercase tracking-[0.3em] font-medium">
          PayloadX Engine &copy; 2026 &nbsp;·&nbsp; Created by <span className="text-tx-secondary">Sundan Sharma</span>
        </p>
      </div>
    </div>
  );
}

function EmptyChart({ note }) {
  return (
    <div className="dash-chart-empty">
      <p>{note}</p>
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
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-0.5 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-1)] hover:bg-[var(--surface-3)] hover:border-[var(--border-2)] transition-all group text-left"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-tx-secondary group-hover:text-tx-primary transition-colors uppercase tracking-wide">
          {title}
        </span>
        <svg className="w-3 h-3 text-tx-muted group-hover:text-tx-secondary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <p className="text-[10px] text-tx-muted leading-snug">{desc}</p>
    </button>
  );
}
