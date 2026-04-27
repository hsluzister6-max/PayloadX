import api from '@/lib/api';
import { getRequestRuntime, isTauriRuntime } from '@/lib/runtime';

const REQUEST_PROXY_PATH = '/api/request/execute';
const NATIVE_WATCHDOG_TIMEOUT_MS = 35_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;

const AUTO_FORWARD_HEADERS = [
  ['ngrok-skip-browser-warning', 'true'],
  ['Bypass-Tunnel-Reminder', 'true'],
];

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

    const message =
      typeof error === 'string' ? error : error?.message || String(error);

    if (message.includes('failed to fill whole buffer') || message.includes('os error 10054')) {
      throw 'Connection reset by peer: The server closed the connection unexpectedly.';
    }

    throw message;
  }
}

async function executeBrowserProxyRequest(payload) {
  try {
    const { data } = await api.post(REQUEST_PROXY_PATH, payload);
    return data;
  } catch (error) {
    const message =
      error?.response?.data?.error ||
      error?.message ||
      'Request proxy failed.';

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
