/**
 * URL helpers for matching cookie jar and per-domain default headers (same rules as Tauri cookie_storage_key).
 */

export function tryRequestUrlHost(urlString) {
  if (!urlString || !String(urlString).trim()) return null;
  const s = String(urlString).trim();
  try {
    const withProto = /^[a-zA-Z][a-zA-Z+\-.]*:\/\//.test(s) ? s : `https://${s}`;
    const u = new URL(withProto);
    return u.hostname || null;
  } catch {
    return null;
  }
}

/** Aligns with Rust cookie jar bucket: lowercase host, loopback → localhost, non-default ports as `:port`. */
export function tryRequestUrlCookieKey(urlString) {
  if (!urlString || !String(urlString).trim()) return null;
  const s = String(urlString).trim();
  try {
    const withProto = /^[a-zA-Z][a-zA-Z+\-.]*:\/\//.test(s) ? s : `https://${s}`;
    const u = new URL(withProto);
    let host = (u.hostname || '').toLowerCase();
    if (host === '127.0.0.1' || host === '::1') host = 'localhost';
    if (!host) return null;
    const port = u.port;
    if (!port) return host;
    const def = u.protocol === 'https:' ? '443' : u.protocol === 'http:' ? '80' : '';
    if (def && port === def) return host;
    return `${host}:${port}`;
  } catch {
    return null;
  }
}
