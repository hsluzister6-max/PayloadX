import { useEffect } from 'react';
import { Server, Cpu, HardDrive, Clock, Copy } from 'lucide-react';
import { useAdminStore } from '../store/adminStore';
import { getApiBaseUrl } from '../lib/api';
import {
  PageHeader,
  Panel,
  Empty,
  Kpi,
  ChartTip,
  CHART,
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '../components/ui';

export default function SystemPage() {
  const { data, days, fetchOverview, pollLive, flash } = useAdminStore();

  useEffect(() => {
    if (!data) fetchOverview(days);
    pollLive();
    const id = setInterval(() => pollLive(), 10_000);
    return () => clearInterval(id);
  }, [data, fetchOverview, days, pollLive]);

  const load = data?.load || {};
  const stats = data?.stats || {};

  const copyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(getApiBaseUrl());
      flash('API URL copied');
    } catch {
      flash('Clipboard unavailable');
    }
  };

  return (
    <div className="page">
      <PageHeader title="System" description="API load, memory, and runtime health">
        <button type="button" className="btn-ghost" onClick={copyEndpoint}>
          <Copy size={14} />
          Copy API URL
        </button>
      </PageHeader>

      <div className="kpi-grid kpi-grid--4">
        <Kpi
          icon={<Server size={18} />}
          label="Req / min"
          value={stats.requestsPerMinute ?? load.requestsPerMinute ?? 0}
          hint="current window"
        />
        <Kpi
          icon={<Cpu size={18} />}
          label="Heap used"
          value={load.memory ? `${load.memory.heapUsedMb}` : '—'}
          hint="MB"
        />
        <Kpi
          icon={<HardDrive size={18} />}
          label="RSS"
          value={load.memory ? `${load.memory.rssMb}` : '—'}
          hint="MB"
        />
        <Kpi
          icon={<Clock size={18} />}
          label="Uptime"
          value={load.uptimeSec != null ? `${Math.round(load.uptimeSec / 60)}` : '—'}
          hint="minutes"
        />
      </div>

      <Panel title="API load" meta="Requests per minute">
        {!load.rpmHistory?.length ? (
          <Empty note="Load history appears after API traffic" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={load.rpmHistory} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Area
                type="monotone"
                dataKey="requests"
                name="Req/min"
                stroke="#58A6FF"
                fill="rgba(88,166,255,0.15)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <div className="charts-row">
        <Panel title="Runtime" meta="Process metrics">
          <dl className="meta-grid">
            <div>
              <dt>Started</dt>
              <dd className="mono">{load.startedAt ? new Date(load.startedAt).toLocaleString() : '—'}</dd>
            </div>
            <div>
              <dt>Total requests</dt>
              <dd className="mono">{load.totalRequests ?? '—'}</dd>
            </div>
            <div>
              <dt>Server errors</dt>
              <dd className="mono">{load.totalErrors ?? '—'}</dd>
            </div>
            <div>
              <dt>Heap total</dt>
              <dd className="mono">{load.memory ? `${load.memory.heapTotalMb} MB` : '—'}</dd>
            </div>
            <div>
              <dt>API base</dt>
              <dd className="mono truncate">{getApiBaseUrl()}</dd>
            </div>
            <div>
              <dt>Activity today</dt>
              <dd className="mono">{stats.activityToday ?? '—'}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Platform inventory" meta="Stored resources">
          <dl className="meta-grid">
            <div>
              <dt>Collections</dt>
              <dd className="mono">{stats.totalCollections ?? '—'}</dd>
            </div>
            <div>
              <dt>Saved APIs</dt>
              <dd className="mono">{stats.totalApis ?? '—'}</dd>
            </div>
            <div>
              <dt>Teams</dt>
              <dd className="mono">{stats.totalTeams ?? '—'}</dd>
            </div>
            <div>
              <dt>Projects</dt>
              <dd className="mono">{stats.totalProjects ?? '—'}</dd>
            </div>
            <div>
              <dt>Total runs</dt>
              <dd className="mono">{stats.totalRuns ?? '—'}</dd>
            </div>
            <div>
              <dt>Runs today</dt>
              <dd className="mono">{stats.runsToday ?? '—'}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
