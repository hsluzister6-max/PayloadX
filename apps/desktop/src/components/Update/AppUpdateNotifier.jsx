import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { isTauri } from '@/lib/executor';
import { checkForAppUpdate, downloadAndInstallUpdate } from '@/lib/appUpdater';

const CHECK_DELAY_MS = 4000;
const REMIND_AFTER_MS = 60 * 60 * 1000; // 1 hour
const TOAST_ID = 'payloadx-update-available';
const SNOOZE_KEY = 'payloadx-update-snooze';

/** @returns {{ version: string, until: number } | null} */
function readSnooze() {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.version || typeof parsed.until !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSnooze(version, until) {
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify({ version, until }));
  } catch {
    /* ignore quota / private mode */
  }
}

function clearSnooze() {
  try {
    localStorage.removeItem(SNOOZE_KEY);
  } catch {
    /* ignore */
  }
}

function isSnoozedFor(version) {
  const snooze = readSnooze();
  if (!snooze || snooze.version !== version) return false;
  return Date.now() < snooze.until;
}

function msUntilSnoozeEnds(version) {
  const snooze = readSnooze();
  if (!snooze || snooze.version !== version) return 0;
  return Math.max(0, snooze.until - Date.now());
}

export default function AppUpdateNotifier({ enabled = true }) {
  const installingRef = useRef(false);
  const remindTimerRef = useRef(null);
  const initialTimerRef = useRef(null);

  useEffect(() => {
    if (!enabled || !isTauri()) return undefined;

    const clearRemindTimer = () => {
      if (remindTimerRef.current) {
        clearTimeout(remindTimerRef.current);
        remindTimerRef.current = null;
      }
    };

    /** @type {(payload: { currentVersion?: string, manifest?: { version?: string } }) => void} */
    let showUpdateToast;

    const scheduleRemind = (delayMs) => {
      clearRemindTimer();
      remindTimerRef.current = setTimeout(async () => {
        const fresh = await checkForAppUpdate({ silent: true });
        if (fresh.status !== 'available' || !fresh.manifest) {
          clearSnooze();
          return;
        }
        showUpdateToast(fresh);
      }, delayMs);
    };

    const installUpdate = async () => {
      if (installingRef.current) return;
      installingRef.current = true;
      toast.dismiss(TOAST_ID);
      clearSnooze();
      clearRemindTimer();

      const loadingId = toast.loading('Downloading update… 0%', {
        position: 'top-right',
      });

      try {
        await downloadAndInstallUpdate(({ phase, percent }) => {
          if (phase === 'Progress' && typeof percent === 'number') {
            toast.loading(`Downloading update… ${percent}%`, {
              id: loadingId,
              position: 'top-right',
            });
            return;
          }
          if (phase === 'Finished') {
            toast.loading('Installing update…', {
              id: loadingId,
              position: 'top-right',
            });
            return;
          }
          if (phase === 'Restarting') {
            toast.success('Update installed. Restarting…', {
              id: loadingId,
              position: 'top-right',
            });
          }
        });
      } catch (err) {
        installingRef.current = false;
        toast.error(err?.message || 'Update failed', {
          id: loadingId,
          position: 'top-right',
        });
        scheduleRemind(30_000);
      }
    };

    const remindLater = (version) => {
      writeSnooze(version, Date.now() + REMIND_AFTER_MS);
      toast.dismiss(TOAST_ID);
      toast('We’ll remind you about this update in 1 hour', {
        position: 'top-right',
        duration: 3500,
        icon: '⏰',
      });
      scheduleRemind(REMIND_AFTER_MS);
    };

    showUpdateToast = (payload) => {
      const currentVersion = payload?.currentVersion;
      const nextVersion = payload?.manifest?.version;
      if (!nextVersion) return;

      toast(
        (t) => (
          <div className="flex flex-col gap-2 min-w-[260px]">
            <p className="text-[13px] font-semibold text-[color:var(--text-primary)]">
              Update available
            </p>
            <p className="text-[11px] text-[color:var(--text-secondary)] leading-snug">
              {currentVersion
                ? `PayloadX ${currentVersion} → ${nextVersion}`
                : `PayloadX ${nextVersion} is ready to install`}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                className="flex-1 h-8 rounded-md text-[11px] font-bold uppercase tracking-wide bg-[var(--cta-bg)] text-[var(--cta-text)] border border-[var(--cta-border)]"
                disabled={installingRef.current}
                onClick={() => installUpdate()}
              >
                Install now
              </button>
              <button
                type="button"
                className="h-8 px-3 rounded-md text-[11px] font-medium text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] whitespace-nowrap"
                onClick={() => {
                  toast.dismiss(t.id);
                  remindLater(nextVersion);
                }}
              >
                Remind me later
              </button>
            </div>
          </div>
        ),
        {
          duration: Infinity,
          id: TOAST_ID,
          position: 'top-right',
        },
      );
    };

    const runCheck = async () => {
      const result = await checkForAppUpdate({ silent: true });
      if (result.status !== 'available' || !result.manifest) return;

      const version = result.manifest.version;

      if (isSnoozedFor(version)) {
        scheduleRemind(msUntilSnoozeEnds(version) || REMIND_AFTER_MS);
        return;
      }

      showUpdateToast(result);
    };

    initialTimerRef.current = setTimeout(runCheck, CHECK_DELAY_MS);

    return () => {
      if (initialTimerRef.current) clearTimeout(initialTimerRef.current);
      clearRemindTimer();
    };
  }, [enabled]);

  return null;
}
