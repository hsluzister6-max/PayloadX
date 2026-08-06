import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { isTauri } from '@/lib/executor';
import { checkForAppUpdate, downloadAndInstallUpdate } from '@/lib/appUpdater';

const CHECK_DELAY_MS = 4000;

export default function AppUpdateNotifier({ enabled = true }) {
  const checkedRef = useRef(false);
  const installingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isTauri() || checkedRef.current) return;
    checkedRef.current = true;

    const timer = setTimeout(async () => {
      const result = await checkForAppUpdate({ silent: true });
      if (result.status !== 'available' || !result.manifest) return;

      const version = result.manifest.version;
      toast(
        (t) => (
          <div className="flex flex-col gap-2 min-w-[240px]">
            <p className="text-[13px] font-semibold text-[color:var(--text-primary)]">
              Update available
            </p>
            <p className="text-[11px] text-[color:var(--text-secondary)] leading-snug">
              PayloadX {result.currentVersion} → {version}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                className="flex-1 h-8 rounded-md text-[11px] font-bold uppercase tracking-wide bg-[var(--cta-bg)] text-[var(--cta-text)] border border-[var(--cta-border)]"
                disabled={installingRef.current}
                onClick={async () => {
                  if (installingRef.current) return;
                  installingRef.current = true;
                  const loadingId = toast.loading('Downloading update… 0%');
                  try {
                    await downloadAndInstallUpdate(({ phase, percent }) => {
                      if (phase === 'Progress' && typeof percent === 'number') {
                        toast.loading(`Downloading update… ${percent}%`, { id: loadingId });
                        return;
                      }
                      if (phase === 'Finished') {
                        toast.loading('Installing update…', { id: loadingId });
                        return;
                      }
                      if (phase === 'Restarting') {
                        toast.success('Update installed. Restarting…', { id: loadingId });
                      }
                    });
                  } catch (err) {
                    installingRef.current = false;
                    toast.error(err?.message || 'Update failed', { id: loadingId });
                  }
                }}
              >
                Download & restart
              </button>
              <button
                type="button"
                className="h-8 px-3 rounded-md text-[11px] font-medium text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)]"
                onClick={() => toast.dismiss(t.id)}
              >
                Later
              </button>
            </div>
          </div>
        ),
        { duration: Infinity, id: 'payloadx-update-available' },
      );
    }, CHECK_DELAY_MS);

    return () => clearTimeout(timer);
  }, [enabled]);

  return null;
}
