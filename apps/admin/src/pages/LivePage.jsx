import { useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Radio, RefreshCw } from 'lucide-react';
import { useAdminStore } from '../store/adminStore';
import {
  PageHeader,
  Panel,
  Empty,
  Kpi,
  ChartTip,
  CHART,
  Pagination,
  usePagedItems,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '../components/ui';

export default function LivePage() {
  const { data, pollLive, fetchOverview, days, flash } = useAdminStore();

  useEffect(() => {
    if (!data) fetchOverview(days);
    pollLive();
    const id = setInterval(() => pollLive(), 5_000);
    return () => clearInterval(id);
  }, [pollLive, fetchOverview, days, data]);

  const live = data?.live || {};
  const bySection = live.bySection || [];
  const sessionsPaged = usePagedItems(live.users || [], 10);

  return (
    <div className="page">
      <PageHeader
        title="Live"
        description="Realtime presence across PayloadX clients"
      >
        <button
          type="button"
          className="btn-primary btn-primary--sm"
          onClick={async () => {
            await pollLive();
            flash('Live snapshot updated');
          }}
        >
          <RefreshCw size={14} />
          Poll now
        </button>
      </PageHeader>

      <div className="kpi-grid kpi-grid--3">
        <Kpi icon={<Radio size={18} />} label="Live users" value={live.liveUsers ?? 0} hint="unique accounts" live />
        <Kpi icon={<Radio size={18} />} label="Connections" value={live.liveConnections ?? 0} hint="open sockets" />
        <Kpi
          icon={<Radio size={18} />}
          label="Sections active"
          value={bySection.length}
          hint="surfaces in use"
        />
      </div>

      <div className="charts-row">
        <Panel title="Presence by section" meta="Where people are right now">
          {bySection.length === 0 ? (
            <Empty note="No active sections" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={bySection.map((s) => ({
                  ...s,
                  name: s.section.length > 14 ? `${s.section.slice(0, 14)}…` : s.section,
                }))}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
              >
                <CartesianGrid stroke={CHART.grid} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={96} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="count" name="Users" fill="#22C55E" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Active sessions" meta="Auto-refreshes every 5s" flush>
          {sessionsPaged.total === 0 ? (
            <Empty note="No live sessions" />
          ) : (
            <>
              <ul className="live-list live-list--padded">
                {sessionsPaged.pageItems.map((u) => (
                  <li key={u.userId}>
                    <span className="live-dot" />
                    <div>
                      <strong>{u.name || u.email || u.userId}</strong>
                      <span>
                        {u.section || 'app'}
                        {u.email ? ` · ${u.email}` : ''}
                        {u.connectedAt
                          ? ` · since ${format(parseISO(u.connectedAt), 'HH:mm')}`
                          : ''}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination
                page={sessionsPaged.page}
                pageSize={sessionsPaged.pageSize}
                total={sessionsPaged.total}
                onPageChange={sessionsPaged.setPage}
              />
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
