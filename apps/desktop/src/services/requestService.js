import api from '@/lib/api';
import { getRequestRuntime, isTauriRuntime } from '@/lib/runtime';

const REQUEST_PROXY_PATH = '/api/request/execute';
const NATIVE_WATCHDOG_TIMEOUT_MS = 35_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;

/** Merged at send time when the same key is not already set by an enabled header row. */
export const AUTO_FORWARD_HEADERS = [
  ['ngrok-skip-browser-warning', 'true'],
  ['Bypass-Tunnel-Reminder', 'true'],
];

function enabledUserHeaderKeys(headers = []) {
  return new Set(
    (headers || [])
      .filter((h) => h?.enabled !== false && String(h?.key ?? '').trim())
      .map((h) => String(h.key).trim().toLowerCase()),
  );
}

function maskSecret(s) {
  const t = String(s ?? '');
  if (!t) return '—';
  if (t.length <= 8) return '••••••••';
  return `${t.slice(0, 4)}…${t.slice(-3)}`;
}

function rawBodyContentType(rawLanguage) {
  switch (rawLanguage?.toLowerCase?.()) {
    case 'json':
      return 'application/json';
    case 'xml':
      return 'application/xml';
    case 'html':
      return 'text/html';
    default:
      return 'text/plain';
  }
}

/**
 * Read-only preview of headers added or implied when the request is sent (native client + JS merge).
 * Lines up with `normalizeHeaderList` auto-forwards and `http.rs` auth, cookies, and body behavior.
 */
export function getImplicitRequestHeadersPreview({
  headers = [],
  method = 'GET',
  body = { mode: 'none' },
  auth = { type: 'none' },
  resolveVariables = (x) => x,
} = {}) {
  const rows = [];
  const keys = enabledUserHeaderKeys(headers);

  AUTO_FORWARD_HEADERS.forEach(([key, value]) => {
    if (!keys.has(key.toLowerCase())) {
      rows.push({
        key,
        value,
        source: 'Tunnel / dev URL helpers (merged if you do not set the same key)',
      });
    }
  });

  const m = String(method || 'GET').toUpperCase();
  if (m !== 'GET' && m !== 'HEAD' && !keys.has('content-type')) {
    const mode = body?.mode || 'none';
    if (mode === 'raw') {
      rows.push({
        key: 'Content-Type',
        value: rawBodyContentType(body.rawLanguage),
        source: 'Inferred from raw body type when Content-Type is unset',
      });
    } else if (mode === 'form-data') {
      rows.push({
        key: 'Content-Type',
        value: 'multipart/form-data (boundary chosen by client)',
        source: 'Set for multipart bodies when Content-Type is unset',
      });
    } else if (mode === 'urlencoded') {
      rows.push({
        key: 'Content-Type',
        value: 'application/x-www-form-urlencoded',
        source: 'Set for URL-encoded form bodies when Content-Type is unset',
      });
    }
  }

  const a = auth || {};
  if (!keys.has('authorization')) {
    if (a.type === 'bearer') {
      const rawTok = String(a.bearer?.token ?? '');
      const tok = resolveVariables(rawTok);
      if (tok.trim()) {
        rows.push({
          key: 'Authorization',
          value: `Bearer ${maskSecret(tok)}`,
          source: 'Auth tab (Bearer)',
        });
      }
    } else if (a.type === 'basic') {
      const u = resolveVariables(a.basic?.username ?? '');
      const p = resolveVariables(a.basic?.password ?? '');
      if (u.trim() || p.trim()) {
        rows.push({
          key: 'Authorization',
          value: 'Basic <base64-encoded credentials from Auth tab>',
          source: 'Auth tab (Basic)',
        });
      }
    }
  }

  const loc = a.apikey?.in ?? a.apikey?.location ?? 'header';
  if (a.type === 'apikey' && loc === 'header') {
    const name = String(resolveVariables(a.apikey?.key ?? '')).trim();
    if (name && !keys.has(name.toLowerCase())) {
      rows.push({
        key: name,
        value: maskSecret(resolveVariables(a.apikey?.value ?? '')),
        source: 'Auth tab (API key → header)',
      });
    }
  }

  return rows;
}

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

/**
 * Host key used by the Tauri cookie jar (matches Rust `cookie_storage_key`):
 * lowercase host, loopback → localhost, non-default ports appended as `:port`.
 */
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

function clampTimeout(timeoutMs) {
  const parsed = Number(timeoutMs);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(Math.max(parsed, 1_000), MAX_TIMEOUT_MS);
}

function normalizeHeaderList(headers = []) {
  const normalized = [];

  headers
    .filter((header) => header?.enabled !== false && header?.key)
    .forEach((header) => {
      normalized.push({
        key: header.key,
        value: header.value ?? '',
        enabled: true,
      });
    });

  AUTO_FORWARD_HEADERS.forEach(([key, value]) => {
    const alreadyPresent = normalized.some(
      (header) => header.key.toLowerCase() === key.toLowerCase()
    );

    if (!alreadyPresent) {
      normalized.push({ key, value, enabled: true });
    }
  });

  return normalized;
}

function normalizeBody(body = {}) {
  const mode = body?.mode || 'none';

  if (mode === 'raw') {
    return {
      mode,
      raw: body.raw ?? '',
      rawLanguage: body.rawLanguage || 'text',
    };
  }

  if (mode === 'form-data') {
    return {
      mode,
      formData: (body.formData || []).filter((item) => item?.enabled !== false && item?.key),
    };
  }

  if (mode === 'urlencoded') {
    return {
      mode,
      urlencoded: (body.urlencoded || []).filter((item) => item?.enabled !== false && item?.key),
    };
  }

  return { mode: 'none' };
}

function normalizePayload(payload) {
  if (!payload?.url) {
    throw 'Request URL is required.';
  }

  const method = (payload.method || 'GET').toUpperCase();
  const headers = normalizeHeaderList(payload.headers);
  const body = normalizeBody(payload.body);
  const timeoutMs = clampTimeout(payload.timeoutMs);

  return {
    method,
    // The request store keeps the Params grid mirrored into the URL itself.
    url: payload.url,
    headers,
    body,
    auth: payload.auth || { type: 'none' },
    timeoutMs,
  };
}

async function executeNativeRequest(payload) {
  const { invoke } = await import('@tauri-apps/api/tauri');

  const watchdog = new Promise((_, reject) => {
    setTimeout(() => {
      reject('Request Timeout: The native bridge failed to respond within 35s.');
    }, NATIVE_WATCHDOG_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      invoke('execute_request', { payload }),
      watchdog,
    ]);
  } catch (error) {
    console.error('[Tauri Request Error]', error);

    let message =
      typeof error === 'string' ? error : error?.message || String(error);

    if (message.includes('failed to fill whole buffer') || message.includes('os error 10054')) {
      message = 'Connection reset by peer: The server closed the connection unexpectedly.';
    }

    throw message;
  }
}

async function executeBrowserProxyRequest(payload) {
  try {
    const { data } = await api.post(REQUEST_PROXY_PATH, payload);
    return data;
  } catch (error) {
    const status = error?.response?.status;
    const dataErr = error?.response?.data?.error;
    const base =
      (typeof dataErr === 'string' ? dataErr : null)
      || error?.message
      || 'Request proxy failed.';
    const code = error?.code ? ` [${error.code}]` : '';
    let message = `${base}${code}`;

    if (status === 502 || status === 503) {
      message = `Bad gateway (${status}): ${base}. Is the PayloadX backend / proxy running?`;
    }
    if (status === 504) {
      message = `Gateway timeout (${status}): ${base}. The upstream server did not respond in time.`;
    }
    if (!error?.response && error?.code === 'ECONNREFUSED') {
      message = `Could not reach request proxy (connection refused). Start the backend on the configured port or check API_BASE_URL.`;
    }

    throw message;
  }
}

/**
 * Postman-style request execution:
 * - Tauri desktop uses the native bridge and talks to the target directly.
 * - Browser mode uses the backend proxy, which keeps SSRF protection enabled.
 */
export async function executeHttpRequest(payload) {
  const normalizedPayload = normalizePayload(payload);

  if (isTauriRuntime()) {
    return executeNativeRequest(normalizedPayload);
  }

  return executeBrowserProxyRequest(normalizedPayload);
}

export { getRequestRuntime };
