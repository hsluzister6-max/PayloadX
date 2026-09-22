import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Camera,
  KeyRound,
  Layers,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
  User,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore, isLightTheme } from '@/store/uiStore';
import { getServerBaseUrl, useServerConfigStore } from '@/store/serverConfigStore';
import api from '@/lib/api';
import { fileToAvatarDataUrl } from '@/utils/avatarImage';
import UserAvatar, { hasUsableAvatar } from './UserAvatar';
import McpTokenSection from './McpTokenSection';
import AppUpdateSection from '@/components/Update/AppUpdateSection';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'workspace', label: 'Workspace', icon: Layers },
  { id: 'updates', label: 'Updates', icon: RefreshCw },
  { id: 'tokens', label: 'MCP', icon: KeyRound },
];

function SettingsRow({ label, hint, children }) {
  return (
    <div className="settings-row">
      <div className="settings-row__label">
        <span>{label}</span>
        {hint && <p>{hint}</p>}
      </div>
      <div className="settings-row__control">{children}</div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, logout, fetchMe } = useAuthStore();
  const { teams, currentTeam } = useTeamStore();
  const { currentProject } = useProjectStore();
  const { setActiveV2Nav, theme, toggleTheme } = useUIStore();
  const { serverMode } = useServerConfigStore();
  const fileRef = useRef(null);

  const [section, setSection] = useState('profile');
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    fetchMe?.();
  }, [fetchMe]);

  useEffect(() => {
    setName(user?.name || '');
  }, [user?.name]);

  const hasPhoto = hasUsableAvatar(user?.avatar);
  const baseUrl = getServerBaseUrl();
  const light = isLightTheme(theme);

  const workspaceRows = useMemo(
    () => [
      { label: 'Current team', value: currentTeam?.name || 'None' },
      { label: 'Current project', value: currentProject?.name || 'None' },
      { label: 'Teams joined', value: String(teams?.length ?? 0) },
      { label: 'Server mode', value: serverMode === 'local' ? 'Local' : 'Cloud' },
      { label: 'API base URL', value: baseUrl, mono: true },
    ],
    [currentTeam, currentProject, teams, serverMode, baseUrl],
  );

  const persistAvatar = async (avatar) => {
    setAvatarBusy(true);
    try {
      const { data } = await api.put('/api/auth/me', { avatar });
      useAuthStore.setState({ user: data.user });
      toast.success(avatar ? 'Photo updated' : 'Photo removed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update photo');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      await persistAvatar(dataUrl);
    } catch (err) {
      toast.error(err.message || 'Could not process image');
    }
  };

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
    <div className="settings-page animate-in">
      <header className="settings-top">
        <div className="settings-top__left">
          <button
            type="button"
            className="settings-icon-btn"
            onClick={() => setActiveV2Nav('dashboard')}
            title="Back to dashboard"
          >
            <ArrowLeft size={16} strokeWidth={2} />
          </button>
          <div>
            <p className="settings-kicker">Settings</p>
            <h1 className="settings-title">Account</h1>
          </div>
        </div>

        <nav className="settings-pill-nav" aria-label="Account sections">
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`settings-pill ${section === item.id ? 'is-active' : ''}`}
                onClick={() => setSection(item.id)}
              >
                <Icon size={13} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="settings-top__right">
          <button type="button" className="settings-ghost-btn" onClick={toggleTheme}>
            {light ? <Moon size={14} /> : <Sun size={14} />}
            {light ? 'Dark' : 'Light'}
          </button>
          <button
            type="button"
            className="settings-ghost-btn settings-ghost-btn--danger"
            onClick={handleLogout}
            disabled={signingOut}
          >
            <LogOut size={14} />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      <div className="settings-identity">
        <UserAvatar user={user} />
        <div className="settings-identity__text">
          <strong>{user?.name || 'User'}</strong>
          <span>{user?.email || '—'}</span>
        </div>
        <div className="settings-identity__meta">
          <span>{serverMode === 'local' ? 'Local' : 'Cloud'}</span>
          <span>·</span>
          <span>
            {teams?.length ?? 0} team{(teams?.length ?? 0) === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="settings-sheet">
        {section === 'profile' && (
          <section className="settings-section" id="profile">
            <div className="settings-section__head">
              <h2>Profile</h2>
              <p>Update how you appear across the workspace.</p>
            </div>
            <form onSubmit={handleSave} className="settings-form">
              <SettingsRow label="Profile picture" hint="JPG, PNG, WebP, or GIF. Saved immediately.">
                <div className="settings-avatar-control">
                  <UserAvatar user={user} size="lg" />
                  <div className="settings-avatar-actions">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      hidden
                      onChange={handleAvatarPick}
                    />
                    <button
                      type="button"
                      className="settings-ghost-btn"
                      disabled={avatarBusy}
                      onClick={() => fileRef.current?.click()}
                    >
                      <Camera size={14} />
                      {avatarBusy ? 'Uploading…' : hasPhoto ? 'Change photo' : 'Upload photo'}
                    </button>
                    {hasPhoto && (
                      <button
                        type="button"
                        className="settings-ghost-btn settings-ghost-btn--danger"
                        disabled={avatarBusy}
                        onClick={() => persistAvatar('')}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </SettingsRow>
              <SettingsRow label="Display name" hint="Shown to teammates in presence and activity.">
                <input
                  className="settings-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={100}
                />
              </SettingsRow>
              <SettingsRow label="Email" hint="Sign-in email cannot be changed here.">
                <input
                  className="settings-input settings-input--locked"
                  value={user?.email || ''}
                  disabled
                />
              </SettingsRow>
              <div className="settings-section__actions">
                <button type="submit" className="settings-primary-btn" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </section>
        )}

        {section === 'workspace' && (
          <section className="settings-section" id="workspace">
            <div className="settings-section__head">
              <h2>Workspace</h2>
              <p>Current team, project, and API server context.</p>
            </div>
            <div className="settings-table">
              {workspaceRows.map((row) => (
                <div key={row.label} className="settings-table__row">
                  <span className="settings-table__key">{row.label}</span>
                  <span
                    className={`settings-table__val${row.mono ? ' settings-table__val--mono' : ''}`}
                    title={row.value}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {section === 'updates' && (
          <section className="settings-section" id="updates">
            <div className="settings-section__head">
              <h2>App updates</h2>
              <p>Installed version and desktop updater.</p>
            </div>
            <AppUpdateSection variant="settings" />
          </section>
        )}

        {section === 'tokens' && (
          <section className="settings-section" id="tokens">
            <div className="settings-section__head settings-section__head--row">
              <div>
                <h2>MCP</h2>
                <p>API tokens for Cursor or Claude. Valid until you revoke them.</p>
              </div>
              <a
                className="settings-link"
                href="https://payloadx.in/docs"
                target="_blank"
                rel="noreferrer"
              >
                Setup guide →
              </a>
            </div>
            <McpTokenSection embedded />
          </section>
        )}
      </div>
    </div>
  );
}
