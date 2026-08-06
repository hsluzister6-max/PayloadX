import { getVersion } from '@tauri-apps/api/app';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Download, RefreshCw } from 'lucide-react';
import { isTauri } from '@/lib/executor';
import { checkForAppUpdate, downloadAndInstallUpdate } from '@/lib/appUpdater';

/** @typedef {'idle'|'checking'|'current'|'available'|'downloading'|'restarting'|'error'} UpdateUiState */

export default function AppUpdateSection() {
  const [currentVersion, setCurrentVersion] = useState('—');
  const [availableVersion, setAvailableVersion] = useState(null);
  const [uiState, setUiState] = useState(/** @type {UpdateUiState} */ ('idle'));
  const [downloadPercent, setDownloadPercent] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [lastError, setLastError] = useState(null);

  const desktop = isTauri();
  const busy = uiState === 'checking' || uiState === 'downloading' || uiState === 'restarting';

  const runCheck = useCallback(async () => {
    if (!desktop || busy) return;

    setUiState('checking');
    setLastError(null);
    setStatusMessage(null);
    setAvailableVersion(null);
    setDownloadPercent(null);

    try {
      const result = await checkForAppUpdate();

      if (result.currentVersion) setCurrentVersion(result.currentVersion);

      if (result.status === 'available') {
        const nextVersion = result.manifest?.version || 'new version';
        setAvailableVersion(nextVersion);
        setUiState('available');
        setStatusMessage(`Version ${nextVersion} is available. Download and restart to update.`);
        toast.success(`Update ${nextVersion} is available`);
        return;
      }

      if (result.status === 'current') {
        setUiState('current');
        setStatusMessage(`Already up to date. You're running the latest version (${result.currentVersion}).`);
        toast.success('Already up to date');
        return;
      }

      if (result.status === 'error') {
        setUiState('error');
        setLastError(result.error || 'Could not check for updates');
        toast.error(result.error || 'Could not check for updates');
      }
    } catch (err) {
      const message = err?.message || String(err);
      setUiState('error');
      setLastError(message);
      toast.error(message);
    }
  }, [desktop, busy]);

  useEffect(() => {
    if (!desktop) return;
    getVersion().then(setCurrentVersion).catch(() => {});
  }, [desktop]);

  const handleDownloadAndRestart = async () => {
    if (!desktop || busy || !availableVersion) return;

    setUiState('downloading');
    setDownloadPercent(0);
    setLastError(null);
    setStatusMessage('Downloading update…');

    const loadingId = toast.loading('Downloading update… 0%');

    try {
      await downloadAndInstallUpdate(({ phase, percent }) => {
        if (phase === 'Progress' && typeof percent === 'number') {
          setDownloadPercent(percent);
          setStatusMessage(`Downloading update… ${percent}%`);
          toast.loading(`Downloading update… ${percent}%`, { id: loadingId });
          return;
        }

        if (phase === 'Finished') {
          setDownloadPercent(100);
          setStatusMessage('Installing update…');
          toast.loading('Installing update…', { id: loadingId });
          return;
        }

        if (phase === 'Restarting') {
          setUiState('restarting');
          setStatusMessage('Restarting PayloadX to apply the update…');
          toast.success('Update installed. Restarting…', { id: loadingId });
        }
      });
    } catch (err) {
      setUiState('available');
      setDownloadPercent(null);
      setStatusMessage(`Version ${availableVersion} is ready to install.`);
      const message = err?.message || 'Update failed';
      setLastError(message);
      toast.error(message, { id: loadingId });
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

  const statusClass =
    uiState === 'current'
      ? 'app-update-status app-update-status--ok'
      : uiState === 'available'
        ? 'app-update-status app-update-status--available'
        : uiState === 'error'
          ? 'app-update-status app-update-status--error'
          : uiState === 'downloading' || uiState === 'restarting'
            ? 'app-update-status app-update-status--progress'
            : null;

  return (
    <section className="profile-panel">
      <div className="profile-panel__head">
        <h3>App updates</h3>
        <p>Check for new versions, download in the background, and restart to apply.</p>
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
        {availableVersion && (
          <div className="profile-meta-tile">
            <div className="profile-meta-tile__icon">
              <RefreshCw size={15} />
            </div>
            <div className="profile-meta-tile__body">
              <span className="profile-meta-tile__label">Available</span>
              <span className="profile-meta-tile__value profile-meta-tile__value--mono">{availableVersion}</span>
            </div>
          </div>
        )}
      </div>

      {statusMessage && statusClass && (
        <div className={statusClass}>
          {uiState === 'current' && <CheckCircle2 size={14} aria-hidden />}
          <span>{statusMessage}</span>
        </div>
      )}

      {uiState === 'downloading' && typeof downloadPercent === 'number' && (
        <div className="app-update-progress" aria-hidden>
          <div className="app-update-progress__bar" style={{ width: `${downloadPercent}%` }} />
        </div>
      )}

      {lastError && uiState === 'error' && (
        <p className="text-[11px] text-[color:var(--error)] mt-3 font-mono">{lastError}</p>
      )}

      <div className="profile-form-actions mt-4">
        <button
          type="button"
          className="profile-primary-btn"
          onClick={runCheck}
          disabled={busy}
        >
          {uiState === 'checking' ? 'Checking…' : 'Check for updates'}
        </button>

        {availableVersion && (uiState === 'available' || uiState === 'downloading') && (
          <button
            type="button"
            className="profile-soft-btn"
            onClick={handleDownloadAndRestart}
            disabled={busy}
          >
            {uiState === 'downloading'
              ? (typeof downloadPercent === 'number' ? `Downloading… ${downloadPercent}%` : 'Downloading…')
              : `Download & restart (${availableVersion})`}
          </button>
        )}
      </div>
    </section>
  );
}
