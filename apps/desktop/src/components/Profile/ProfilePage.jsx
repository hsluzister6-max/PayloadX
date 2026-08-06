import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Cloud,
  FolderKanban,
  LogOut,
  Moon,
  Server,
  Sun,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore, isLightTheme } from '@/store/uiStore';
import { getServerBaseUrl, useServerConfigStore } from '@/store/serverConfigStore';
import api from '@/lib/api';
import McpTokenSection from './McpTokenSection';
import AppUpdateSection from '@/components/Update/AppUpdateSection';

function MetaTile({ icon, label, value, mono = false }) {
  return (
    <div className="profile-meta-tile">
      <div className="profile-meta-tile__icon">{icon}</div>
      <div className="profile-meta-tile__body">
        <span className="profile-meta-tile__label">{label}</span>
        <span className={`profile-meta-tile__value${mono ? ' profile-meta-tile__value--mono' : ''}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, logout, fetchMe } = useAuthStore();
  const { teams, currentTeam } = useTeamStore();
  const { currentProject } = useProjectStore();
  const { setActiveV2Nav, theme, toggleTheme } = useUIStore();
  const { serverMode } = useServerConfigStore();

  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    fetchMe?.();
  }, [fetchMe]);

  useEffect(() => {
    setName(user?.name || '');
  }, [user?.name]);

  const initial = (user?.name || user?.email || 'U')[0]?.toUpperCase() || 'U';
  const baseUrl = getServerBaseUrl();
  const light = isLightTheme(theme);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put('/api/auth/me', { name: name.trim() });
      useAuthStore.setState({ user: data.user });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await logout();
      toast.success('Signed out');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="profile-page animate-in">
      <header className="profile-header">
        <div className="profile-header__left">
          <button
            type="button"
            className="profile-icon-btn"
            onClick={() => setActiveV2Nav('dashboard')}
            title="Back to dashboard"
          >
            <ArrowLeft size={16} strokeWidth={2} />
          </button>
          <div>
            <p className="profile-kicker">Settings</p>
            <h1 className="profile-title">Account</h1>
          </div>
        </div>
        <div className="profile-header__right">
          <button type="button" className="profile-soft-btn" onClick={toggleTheme}>
            {light ? <Moon size={14} /> : <Sun size={14} />}
            {light ? 'Dark' : 'Light'}
          </button>
          <button
            type="button"
            className="profile-soft-btn profile-soft-btn--danger"
            onClick={handleLogout}
            disabled={signingOut}
          >
            <LogOut size={14} />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      <section className="profile-identity">
        <div className="profile-identity__main">
          <div className="profile-avatar-lg" aria-hidden>
            {initial}
          </div>
          <div className="profile-identity__text">
            <h2>{user?.name || 'User'}</h2>
            <p>{user?.email || '—'}</p>
            <div className="profile-identity__chips">
              <span className="profile-chip">
                {serverMode === 'local' ? 'Local server' : 'Cloud'}
              </span>
              <span className="profile-chip profile-chip--muted">
                {teams?.length ?? 0} team{(teams?.length ?? 0) === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="profile-grid">
        <section className="profile-panel">
          <div className="profile-panel__head">
            <h3>Profile</h3>
            <p>Update how you appear across the workspace.</p>
          </div>
          <form onSubmit={handleSave} className="profile-form">
            <label className="profile-field">
              <span>Display name</span>
              <input
                className="profile-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={100}
              />
            </label>
            <label className="profile-field">
              <span>Email</span>
              <input className="profile-input profile-input--locked" value={user?.email || ''} disabled />
            </label>
            <div className="profile-form-actions">
              <button type="submit" className="profile-primary-btn" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </section>

        <section className="profile-panel">
          <div className="profile-panel__head">
            <h3>Workspace</h3>
            <p>Current context for teams, projects, and API server.</p>
          </div>
          <div className="profile-meta-grid">
            <MetaTile
              icon={<Users size={15} />}
              label="Current team"
              value={currentTeam?.name || 'None'}
            />
            <MetaTile
              icon={<FolderKanban size={15} />}
              label="Current project"
              value={currentProject?.name || 'None'}
            />
            <MetaTile
              icon={serverMode === 'local' ? <Server size={15} /> : <Cloud size={15} />}
              label="Server mode"
              value={serverMode === 'local' ? 'Local' : 'Cloud'}
            />
            <MetaTile
              icon={<Server size={15} />}
              label="API base URL"
              value={baseUrl}
              mono
            />
          </div>
        </section>

        <AppUpdateSection />

        <section className="profile-panel profile-panel--wide">
          <div className="profile-panel__head profile-panel__head--row">
            <div>
              <h3>MCP &amp; API tokens</h3>
              <p>
                Generate tokens for Cursor or Claude. Tokens stay valid until you revoke them.
              </p>
            </div>
            <a className="profile-docs-link" href="https://payloadx.app/docs/mcp" target="_blank" rel="noreferrer">
              Setup guide →
            </a>
          </div>
          <McpTokenSection embedded />
        </section>
      </div>
    </div>
  );
}
