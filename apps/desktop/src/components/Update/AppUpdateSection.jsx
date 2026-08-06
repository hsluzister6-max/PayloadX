import { getVersion } from '@tauri-apps/api/app';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, RefreshCw } from 'lucide-react';
import { isTauri } from '@/lib/executor';
import { checkForAppUpdate, downloadAndInstallUpdate } from '@/lib/appUpdater';

export default function AppUpdateSection() {
  const [currentVersion, setCurrentVersion] = useState('—');
  const [pendingVersion, setPendingVersion] = useState(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [lastError, setLastError] = useState(null);

  const desktop = isTauri();

  const runCheck = useCallback(async () => {
    if (!desktop) return;
    setChecking(true);
    setLastError(null);
    try {
      const result = await checkForAppUpdate();
      if (result.currentVersion) setCurrentVersion(result.currentVersion);
      if (result.status === 'available') {
        setPendingVersion(result.manifest?.version || 'new version');
        toast.success(`Update ${result.manifest?.version} is available`);
      } else if (result.status === 'current') {
        setPendingVersion(null);
        toast.success('You’re on the latest version');
      } else if (result.status === 'error') {
        setLastError(result.error || 'Could not check for updates');
        toast.error(result.error || 'Could not check for updates');
      }
    } finally {
      setChecking(false);
    }
  }, [desktop]);

  useEffect(() => {
    if (!desktop) return;
    getVersion().then(setCurrentVersion).catch(() => {});
  }, [desktop]);

  const handleInstall = async () => {
    if (!desktop || installing) return;
    setInstalling(true);
    const loadingId = toast.loading('Downloading update…');
    try {
      await downloadAndInstallUpdate(({ chunkLength, contentLength }) => {
        if (!contentLength) return;
        const pct = Math.min(100, Math.round((chunkLength / contentLength) * 100));
        toast.loading(`Downloading update… ${pct}%`, { id: loadingId });
      });
    } catch (err) {
      toast.error(err?.message || 'Update failed', { id: loadingId });
      setInstalling(false);
    }
  };

  if (!desktop) {
    return (
      <section className="profile-panel">
        <div className="profile-panel__head">
          <h3>App updates</h3>
          <p>Install the PayloadX desktop app to receive automatic updates.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="profile-panel">
      <div className="profile-panel__head">
        <h3>App updates</h3>
        <p>Check for new versions and install over the air without re-downloading the full installer.</p>
      </div>

      <div className="profile-meta-grid">
        <div className="profile-meta-tile">
          <div className="profile-meta-tile__icon">
            <Download size={15} />
          </div>
          <div className="profile-meta-tile__body">
            <span className="profile-meta-tile__label">Installed version</span>
            <span className="profile-meta-tile__value profile-meta-tile__value--mono">{currentVersion}</span>
          </div>
        </div>
        {pendingVersion && (
          <div className="profile-meta-tile">
            <div className="profile-meta-tile__icon">
              <RefreshCw size={15} />
            </div>
            <div className="profile-meta-tile__body">
              <span className="profile-meta-tile__label">Available</span>
              <span className="profile-meta-tile__value profile-meta-tile__value--mono">{pendingVersion}</span>
            </div>
          </div>
        )}
      </div>

      {lastError && (
        <p className="text-[11px] text-[color:var(--error)] mt-3 font-mono">{lastError}</p>
      )}

      <div className="profile-form-actions mt-4">
        <button
          type="button"
          className="profile-primary-btn"
          onClick={runCheck}
          disabled={checking || installing}
        >
          {checking ? 'Checking…' : 'Check for updates'}
        </button>
        {pendingVersion && (
          <button
            type="button"
            className="profile-soft-btn"
            onClick={handleInstall}
            disabled={installing || checking}
          >
            {installing ? 'Installing…' : `Install ${pendingVersion}`}
          </button>
        )}
      </div>
    </section>
  );
}
