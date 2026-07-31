import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { getServerBaseUrl, useServerConfigStore } from '@/store/serverConfigStore';
import api from '@/lib/api';
import McpTokenSection from './McpTokenSection';

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
        <div>
          <h1 className="profile-title">Account</h1>
          <p className="profile-subtitle">Profile, workspace, and MCP access</p>
        </div>
        <button type="button" className="profile-ghost-btn" onClick={() => setActiveV2Nav('dashboard')}>
          Back to Dashboard
        </button>
      </header>

      <div className="profile-grid">
        <section className="profile-card profile-card--hero">
          <div className="profile-hero-row">
            <div className="profile-avatar-lg">{initial}</div>
            <div className="profile-hero-text">
              <h2>{user?.name || 'User'}</h2>
              <p>{user?.email || '—'}</p>
              <span className="profile-chip">{theme === 'light' ? 'Light theme' : 'Dark theme'}</span>
            </div>
          </div>

          <form onSubmit={handleSave} className="profile-form">
            <label className="profile-label">
              Display name
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={100}
              />
            </label>
            <label className="profile-label">
              Email
              <input className="input" value={user?.email || ''} disabled />
            </label>
            <div className="profile-form-actions">
              <button type="submit" className="profile-primary-btn" disabled={saving}>
                {saving ? 'Saving…' : 'Save profile'}
              </button>
              <button type="button" className="profile-ghost-btn" onClick={toggleTheme}>
                Toggle theme
              </button>
            </div>
          </form>
        </section>

        <section className="profile-card">
          <h3 className="profile-section-title">Workspace</h3>
          <div className="profile-kv">
            <span>Current team</span>
            <strong>{currentTeam?.name || 'None'}</strong>
          </div>
          <div className="profile-kv">
            <span>Current project</span>
            <strong>{currentProject?.name || 'None'}</strong>
          </div>
          <div className="profile-kv">
            <span>Teams</span>
            <strong>{teams?.length ?? 0}</strong>
          </div>
          <div className="profile-kv">
            <span>Server mode</span>
            <strong>{serverMode === 'local' ? 'Local' : 'Cloud Build'}</strong>
          </div>
          <div className="profile-kv profile-kv--stack">
            <span>API base URL</span>
            <code>{baseUrl}</code>
          </div>
          {user?._id && (
            <div className="profile-kv profile-kv--stack">
              <span>User ID</span>
              <code>{user._id}</code>
            </div>
          )}
        </section>

        <section className="profile-card profile-card--wide">
          <div className="profile-section-head">
            <div>
              <h3 className="profile-section-title">MCP / API Tokens</h3>
              <p className="profile-section-desc">
                Tokens are stored in the database and remain valid until you revoke them below.
                Use them in Cursor/Claude to create APIs in your PayloadX workspace.
              </p>
            </div>
          </div>
          <McpTokenSection />
        </section>

        <section className="profile-card profile-card--danger">
          <h3 className="profile-section-title">Session</h3>
          <p className="profile-section-desc">Sign out clears local session data on this device.</p>
          <button type="button" className="profile-danger-btn" onClick={handleLogout} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </section>
      </div>
    </div>
  );
}
