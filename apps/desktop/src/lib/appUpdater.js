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
 * Download, install update bundle, and relaunch the app.
 * @param {(event: { chunkLength: number, contentLength?: number }) => void} [onProgress]
 */
export async function downloadAndInstallUpdate(onProgress) {
  if (!isTauri()) {
    throw new Error('Updates are only available in the desktop app');
  }

  await installUpdate(onProgress);
  await relaunch();
}
