import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { isTauri } from '@/lib/executor';
import { checkForAppUpdate, downloadAndInstallUpdate } from '@/lib/appUpdater';

const CHECK_DELAY_MS = 2500;
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

export default function AppUpdateNotifier() {
  const installingRef = useRef(false);
  const remindTimerRef = useRef(null);
  const initialTimerRef = useRef(null);
  const hourlyTimerRef = useRef(null);

  useEffect(() => {
    if (!isTauri()) return undefined;

    let cancelled = false;

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
      remindTimerRef.current = setTimeout(() => {
        runCheck({ ignoreSnooze: true });
      }, Math.max(1000, delayMs));
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
      scheduleRemind(REMIND_AFTER_MS);
    };

    showUpdateToast = (payload) => {
      const currentVersion = payload?.currentVersion;
      const nextVersion = payload?.manifest?.version;
      if (!nextVersion) return;

      toast.custom(
        (t) => (
          <div
            className="pointer-events-auto flex flex-col gap-2.5 min-w-[280px] max-w-[340px] px-3.5 py-3 rounded-xl shadow-lg"
            style={{
              background: 'var(--surface-2, #1A1F2B)',
              border: '1px solid var(--border-1, rgba(216, 222, 233, 0.12))',
              color: 'var(--text-primary, #D8DEE9)',
            }}
          >
            <div>
              <p className="text-[13px] font-semibold leading-tight">Update available</p>
              <p className="text-[12px] mt-1 leading-snug" style={{ color: 'var(--text-secondary, #9AA4B2)' }}>
                {currentVersion
                  ? `PayloadX ${currentVersion} → ${nextVersion}`
                  : `PayloadX ${nextVersion} is ready to install`}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                className="flex-1 h-8 rounded-md text-[12px] font-semibold"
                style={{
                  background: 'var(--cta-bg, #58A6FF)',
                  color: 'var(--cta-text, #0B1220)',
                  border: '1px solid var(--cta-border, transparent)',
                }}
                disabled={installingRef.current}
                onClick={() => installUpdate()}
              >
                Install now
              </button>
              <button
                type="button"
                className="h-8 px-3 rounded-md text-[12px] font-medium whitespace-nowrap"
                style={{ color: 'var(--text-muted, #8B949E)' }}
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

    const runCheck = async ({ ignoreSnooze = false } = {}) => {
      if (cancelled || installingRef.current) return;

      const result = await checkForAppUpdate({ silent: true });
      if (cancelled) return;

      // Already on the latest build — stay quiet, like Cursor.
      if (result.status !== 'available' || !result.manifest) {
        toast.dismiss(TOAST_ID);
        clearSnooze();
        clearRemindTimer();
        return;
      }

      const version = result.manifest.version;
      if (!ignoreSnooze && isSnoozedFor(version)) {
        scheduleRemind(msUntilSnoozeEnds(version) || REMIND_AFTER_MS);
        return;
      }

      showUpdateToast(result);
    };

    initialTimerRef.current = setTimeout(() => {
      runCheck();
    }, CHECK_DELAY_MS);

    hourlyTimerRef.current = setInterval(() => {
      runCheck();
    }, REMIND_AFTER_MS);

    const onResume = () => {
      const snooze = readSnooze();
      if (snooze && Date.now() >= snooze.until) {
        runCheck({ ignoreSnooze: true });
      }
    };
    window.addEventListener('focus', onResume);
    document.addEventListener('visibilitychange', onResume);

    return () => {
      cancelled = true;
      if (initialTimerRef.current) clearTimeout(initialTimerRef.current);
      if (hourlyTimerRef.current) clearInterval(hourlyTimerRef.current);
      clearRemindTimer();
      window.removeEventListener('focus', onResume);
      document.removeEventListener('visibilitychange', onResume);
    };
  }, []);

  return null;
}
