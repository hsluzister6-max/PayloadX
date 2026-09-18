import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, isValid } from 'date-fns';
import {
  Users,
  Radio,
  Server,
  MousePointerClick,
  Building2,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { useAdminStore } from '../store/adminStore';
import {
  PageHeader,
  Kpi,
  Panel,
  Empty,
  ChartTip,
  CHART,
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '../components/ui';

function parseDate(value) {
  if (!value) return null;
  const d = typeof value === 'string' ? parseISO(value) : new Date(value);
  return isValid(d) ? d : null;
}

export default function OverviewPage() {
  const { data, error, days, fetchOverview, pollLive } = useAdminStore();

  useEffect(() => {
    fetchOverview(days);
    const live = setInterval(() => pollLive(), 10_000);
    const full = setInterval(() => fetchOverview(days), 60_000);
    return () => {
      clearInterval(live);
      clearInterval(full);
    };
  }, [fetchOverview, pollLive, days]);

  const stats = data?.stats || {};
  const live = data?.live || {};
  const load = data?.load || {};
  const traffic = useMemo(() => data?.trafficOverTime || [], [data]);
  const signups = useMemo(() => data?.signupsOverTime || [], [data]);

  return (
    <div className="page">
      <PageHeader
        title="Overview"
        description={
          <>
            Platform health at a glance
            {data?.generatedAt && (
              <span className="muted">
                {' '}
                · updated {format(parseISO(data.generatedAt), 'HH:mm:ss')}
              </span>
            )}
          </>
        }
      />

      {error && <div className="banner-error">{error}</div>}

      <div className="kpi-grid">
        <Kpi
          icon={<Users size={18} />}
          label="Total users"
          value={stats.totalUsers ?? '—'}
          hint={stats.newUsersToday ? `+${stats.newUsersToday} today` : `${stats.verifiedUsers ?? 0} verified`}
        />
        <Kpi
          icon={<Radio size={18} />}
          label="Live now"
          value={live.liveUsers ?? 0}
          hint={`${live.liveConnections ?? 0} sockets`}
          live
        />
        <Kpi
          icon={<Server size={18} />}
          label="Load"
          value={stats.requestsPerMinute ?? load.requestsPerMinute ?? 0}
          hint="req / min"
        />
        <Kpi
          icon={<MousePointerClick size={18} />}
          label="Click rate"
          value={stats.clickRate != null ? `${stats.clickRate}%` : '—'}
          hint={`${stats.totalClicks || 0} / ${stats.totalViews || 0}`}
        />
        <Kpi
          icon={<Building2 size={18} />}
          label="Teams"
          value={stats.totalTeams ?? '—'}
          hint={`${stats.totalProjects ?? 0} projects`}
        />
        <Kpi
          icon={<Zap size={18} />}
          label="API runs"
          value={stats.totalRuns ?? '—'}
          hint={`${stats.runsToday ?? 0} today`}
        />
      </div>

      <div className="charts-row">
        <Panel title="Traffic" meta={`${days}d · views · clicks · events`}>
          {!traffic.some((d) => d.events > 0) ? (
            <Empty note="Events appear as desktop users navigate sections" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={traffic} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={CHART.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="views" name="Views" stroke="#22C55E" fill="transparent" strokeWidth={2} />
                <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#FEBC2E" fill="transparent" strokeWidth={2} />
                <Area type="monotone" dataKey="events" name="Events" stroke={CHART.accent} fill="url(#trafficFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Signups" meta={`New users · ${days}d`}>
          {!signups.some((d) => d.signups > 0) ? (
            <Empty note="No signups in this window" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={signups} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="signups" name="Signups" fill={CHART.accent} radius={[4, 4, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div className="charts-row">
        <Panel
          title="Recent signups"
          meta={`${stats.verifiedUsers ?? 0} verified`}
          actions={
            <Link to="/users" className="panel-link">
              View all <ArrowRight size={12} />
            </Link>
          }
        >
          {(data?.recentUsers || []).length === 0 ? (
            <Empty note="No users yet" />
          ) : (
            <ul className="user-list">
              {(data?.recentUsers || []).slice(0, 8).map((u) => {
                const when = parseDate(u.createdAt);
                return (
                  <li key={u._id}>
                    <span className="avatar">{(u.name || u.email || '?').slice(0, 1).toUpperCase()}</span>
                    <div>
                      <strong>{u.name || '—'}</strong>
                      <span>{u.email}</span>
                    </div>
                    <time>{when ? format(when, 'MMM d') : '—'}</time>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="Live snapshot"
          meta={`${live.liveUsers ?? 0} online`}
          actions={
            <Link to="/live" className="panel-link">
              Open live <ArrowRight size={12} />
            </Link>
          }
        >
          {(live.users || []).length === 0 ? (
            <Empty note="No live sessions" />
          ) : (
            <ul className="live-list">
              {(live.users || []).slice(0, 8).map((u) => (
                <li key={u.userId}>
                  <span className="live-dot" />
                  <div>
                    <strong>{u.name || u.email || u.userId}</strong>
                    <span>
                      {u.section || 'app'}
                      {u.email ? ` · ${u.email}` : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
