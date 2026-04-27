/**
 * Detect whether the UI is running inside a Tauri webview.
 *
 * We check both the runtime-injected globals and the Tauri build env so the
 * service works in dev and production builds across platforms.
 */
export function isTauriRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(
    window.__TAURI__ ||
    window.__TAURI_INTERNALS__ ||
    import.meta.env.TAURI_PLATFORM
  );
}

export function getRequestRuntime() {
  return isTauriRuntime() ? 'tauri' : 'browser';
}
