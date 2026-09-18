import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Radio,
  BarChart3,
  Server,
  LogOut,
  RefreshCw,
  Download,
  Copy,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAdminStore } from '../store/adminStore';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/live', label: 'Live', icon: Radio },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/system', label: 'System', icon: Server },
];

const RANGES = [7, 14, 30];

export default function Shell({ children }) {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const {
    days,
    setDays,
    fetchOverview,
    pollLive,
    isLoading,
    notice,
    exportOverviewCsv,
    copySummary,
    data,
  } = useAdminStore();

  const liveCount = data?.live?.liveUsers ?? data?.stats?.liveUsers ?? 0;

  const refresh = async () => {
    await fetchOverview(days);
    await pollLive();
    useAdminStore.getState().flash('Dashboard refreshed');
  };

  return (
    <div className="shell">
      <header className="shell-top">
        <div className="shell-top-row">
          <div className="shell-brand">
            <img src="/logo.png" alt="" className="shell-logo" width={34} height={34} />
            <div>
              <strong>
                Payload<span className="brand-x">X</span> Admin
              </strong>
              <span className="shell-sub">Platform console</span>
            </div>
          </div>

          <nav className="pill-nav" aria-label="Admin pages">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `pill-nav-item ${isActive ? 'is-active' : ''}`}
                >
                  <Icon size={14} />
                  {item.label}
                  {item.to === '/live' && liveCount > 0 && (
                    <span className="pill-badge">{liveCount}</span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="shell-meta">
            <span className="shell-user" title={user?.email}>
              {user?.name || user?.email}
            </span>
            <button type="button" className="btn-ghost" onClick={logout}>
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>

        <div className="action-bar">
          <div className="action-bar-left">
            <span className="action-label">Range</span>
            <div className="pill-nav pill-nav--compact" role="group" aria-label="Date range">
              {RANGES.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`pill-nav-item ${days === d ? 'is-active' : ''}`}
                  onClick={() => {
                    setDays(d);
                    fetchOverview(d);
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>
            <span className="action-path mono">
              {location.pathname === '/' ? '/overview' : location.pathname}
            </span>
          </div>

          <div className="action-bar-right">
            <button type="button" className="btn-ghost" onClick={copySummary} title="Copy summary">
              <Copy size={14} />
              Copy
            </button>
            <button type="button" className="btn-ghost" onClick={exportOverviewCsv} title="Export CSV">
              <Download size={14} />
              Export
            </button>
            <button
              type="button"
              className="btn-primary btn-primary--sm"
              onClick={refresh}
              disabled={isLoading}
            >
              <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {notice && <div className="toast-notice">{notice}</div>}

      <main className="shell-main">{children}</main>
    </div>
  );
}
