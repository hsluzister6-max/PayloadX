import { checkUpdate, installUpdate } from '@tauri-apps/api/updater';
import { relaunch } from '@tauri-apps/api/process';
import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@/lib/executor';

/** @typedef {'unavailable'|'current'|'available'|'error'} UpdateStatus */

/**
 * @param {{ silent?: boolean }} [options]
 * @returns {Promise<{ status: UpdateStatus, currentVersion?: string, manifest?: import('@tauri-apps/api/updater').UpdateManifest, error?: string }>}
 */
export async function checkForAppUpdate(options = {}) {
  if (!isTauri()) {
    return { status: 'unavailable' };
  }

  try {
    const currentVersion = await getVersion();
    const { shouldUpdate, manifest } = await checkUpdate();

    if (!shouldUpdate) {
      return { status: 'current', currentVersion };
    }

    return {
      status: 'available',
      currentVersion,
      manifest,
    };
  } catch (err) {
    let message = err?.message || String(err);
    if (/valid release JSON|404|Not Found/i.test(message)) {
      message =
        'Update metadata is not available yet (latest.json missing from GitHub release). Install the newest build from the website or try again after the release finishes.';
    }
    if (!options.silent) {
      console.error('[PayloadX Updater]', err);
    }
    return { status: 'error', error: message };
  }
}

/**
 * @typedef {'Started'|'Progress'|'Finished'|'Restarting'} UpdateInstallPhase
 * @typedef {{ phase: UpdateInstallPhase, percent?: number, chunkLength?: number, contentLength?: number }} UpdateInstallProgress
 */

/**
 * Download, install update bundle, and relaunch the app.
 * @param {(progress: UpdateInstallProgress) => void} [onProgress]
 */
export async function downloadAndInstallUpdate(onProgress) {
  if (!isTauri()) {
    throw new Error('Updates are only available in the desktop app');
  }

  let contentLength;
  let downloaded = 0;

  await installUpdate((event) => {
    if (event.status === 'Started') {
      contentLength = event.data?.contentLength;
      downloaded = 0;
      onProgress?.({ phase: 'Started', contentLength });
      return;
    }

    if (event.status === 'Progress') {
      downloaded += event.data?.chunkLength ?? 0;
      const percent = contentLength
        ? Math.min(100, Math.round((downloaded / contentLength) * 100))
        : undefined;
      onProgress?.({
        phase: 'Progress',
        percent,
        chunkLength: downloaded,
        contentLength,
      });
      return;
    }

    if (event.status === 'Finished') {
      onProgress?.({ phase: 'Finished', percent: 100, contentLength });
    }
  });

  onProgress?.({ phase: 'Restarting' });
  await relaunch();
}
