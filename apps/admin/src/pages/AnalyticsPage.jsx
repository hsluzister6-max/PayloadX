import { useEffect, useMemo } from 'react';
import { Download } from 'lucide-react';
import { useAdminStore } from '../store/adminStore';
import {
  PageHeader,
  Panel,
  Empty,
  ChartTip,
  CHART,
  Pagination,
  usePagedItems,
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
} from '../components/ui';

export default function AnalyticsPage() {
  const { data, days, fetchOverview, exportOverviewCsv } = useAdminStore();

  useEffect(() => {
    if (!data) fetchOverview(days);
  }, [data, fetchOverview, days]);

  const sectionEvents = useMemo(() => data?.sectionEvents || [], [data]);
  const traffic = useMemo(() => data?.trafficOverTime || [], [data]);
  const eventMix = useMemo(
    () => (data?.eventTypeBreakdown || []).map((e, i) => ({ ...e, color: CHART.pie[i % CHART.pie.length] })),
    [data],
  );
  const recentEvents = useMemo(() => data?.recentEvents || [], [data]);

  const sectionsPaged = usePagedItems(sectionEvents, 10);
  const eventsPaged = usePagedItems(recentEvents, 10);

  return (
    <div className="page">
      <PageHeader
        title="Analytics"
        description={`Traffic, click-through, and section events · ${days}d`}
      >
        <button type="button" className="btn-primary btn-primary--sm" onClick={exportOverviewCsv}>
          <Download size={14} />
          Export metrics
        </button>
      </PageHeader>

      <div className="charts-row">
        <Panel title="Traffic over time" meta="Views · clicks · events">
          {!traffic.some((d) => d.events > 0) ? (
            <Empty note="No traffic events in this range" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={traffic} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsFill" x1="0" y1="0" x2="0" y2="1">
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
                <Area type="monotone" dataKey="events" name="Events" stroke={CHART.accent} fill="url(#analyticsFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Event mix" meta="All event types">
          {eventMix.length === 0 ? (
            <Empty note="No event mix yet" />
          ) : (
            <div className="pie-split">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={eventMix} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                    {eventMix.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="legend">
                {eventMix.map((m) => (
                  <li key={m.name}>
                    <span className="dot" style={{ background: m.color }} />
                    <span>{m.name}</span>
                    <strong>{m.value}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Events by section" meta="Views stacked with clicks">
        {sectionEvents.length === 0 ? (
          <Empty note="Navigate PayloadX desktop to populate sections" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={sectionEvents.slice(0, 10).map((s) => ({
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
              <Bar dataKey="views" name="Views" stackId="a" fill="#22C55E" barSize={12} />
              <Bar dataKey="clicks" name="Clicks" stackId="a" fill="#FEBC2E" radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel title="Section detail" meta="Click-through rate per surface" flush>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Section</th>
                <th>Views</th>
                <th>Clicks</th>
                <th>Actions</th>
                <th>CTR</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {sectionsPaged.pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    No section events yet
                  </td>
                </tr>
              ) : (
                sectionsPaged.pageItems.map((row) => (
                  <tr key={row.section}>
                    <td className="mono">{row.section}</td>
                    <td>{row.views}</td>
                    <td>{row.clicks}</td>
                    <td>{row.actions}</td>
                    <td>
                      <span className="ctr">{row.clickRate}%</span>
                    </td>
                    <td>{row.total}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={sectionsPaged.page}
          pageSize={sectionsPaged.pageSize}
          total={sectionsPaged.total}
          onPageChange={sectionsPaged.setPage}
        />
      </Panel>

      <Panel title="Recent events" meta="Latest product analytics" flush>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Section</th>
                <th>Type</th>
                <th>Target</th>
                <th>Client</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {eventsPaged.pageItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    No recent events
                  </td>
                </tr>
              ) : (
                eventsPaged.pageItems.map((ev, i) => (
                  <tr key={ev._id || i}>
                    <td className="mono">{ev.section}</td>
                    <td>
                      <span className="status-pill">{ev.eventType}</span>
                    </td>
                    <td className="mono">{ev.target || '—'}</td>
                    <td>{ev.client || '—'}</td>
                    <td className="mono">
                      {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={eventsPaged.page}
          pageSize={eventsPaged.pageSize}
          total={eventsPaged.total}
          onPageChange={eventsPaged.setPage}
        />
      </Panel>
    </div>
  );
}
