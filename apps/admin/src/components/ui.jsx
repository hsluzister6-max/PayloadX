import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
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

export const CHART = {
  accent: '#C8CDD8',
  grid: 'rgba(255,255,255,0.06)',
  axis: 'rgba(156,163,184,0.9)',
  pie: ['#C8CDD8', '#58A6FF', '#22C55E', '#FEBC2E', '#EF4444', '#A78BFA', '#38BDF8', '#9CA3B8'],
};

export function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label != null && <p className="chart-tip-label">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.dataKey || entry.name}>
          <span style={{ color: entry.color || CHART.accent }}>{entry.name}</span>
          <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
}

export function Kpi({ icon, label, value, hint, live }) {
  return (
    <div className={`kpi ${live ? 'kpi--live' : ''}`}>
      <div className="kpi-icon">{icon}</div>
      <div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">{label}</div>
        {hint && <div className="kpi-hint">{hint}</div>}
      </div>
    </div>
  );
}

export function Panel({ title, meta, children, flush, actions }) {
  return (
    <section className={`panel ${flush ? 'panel--flush' : ''}`}>
      <header className="panel-head">
        <div className="panel-head-left">
          <h2>{title}</h2>
          {meta && <span className="panel-meta">{meta}</span>}
        </div>
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function Empty({ note }) {
  return <div className="empty">{note}</div>;
}

export function PageHeader({ title, description, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  );
}

/** Shared pagination controls */
export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div className="pagination">
      <div className="pagination-meta">
        {total === 0 ? 'No results' : `${from}–${to} of ${total}`}
      </div>
      <div className="pagination-controls">
        {onPageSizeChange && (
          <label className="pagination-size">
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="btn-ghost btn-ghost--xs"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <span className="pagination-page mono">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          className="btn-ghost btn-ghost--xs"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

/** Client-side list pagination helper */
export function usePagedItems(items, pageSize = 10) {
  const [page, setPage] = useState(1);
  const list = items || [];

  useEffect(() => {
    setPage(1);
  }, [list.length, pageSize]);

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [list, safePage, pageSize]);

  return {
    page: safePage,
    setPage,
    pageSize,
    total,
    pageItems,
  };
}

export {
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
};
