import { Buffer } from 'node:buffer';
import { assertPublicHttpUrl, createProxyError } from '@/lib/requestProxySecurity';

const AUTO_FORWARD_HEADERS = [
  ['ngrok-skip-browser-warning', 'true'],
  ['Bypass-Tunnel-Reminder', 'true'],
];

function methodAllowsBody(method) {
  return !['GET', 'HEAD'].includes(method);
}

function encodeBasicAuth(username = '', password = '') {
  return Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
}

function applyAuth(url, headers, auth = {}) {
  if (auth?.type === 'bearer' && auth.bearer?.token) {
    headers.set('authorization', `Bearer ${auth.bearer.token}`);
    return url;
  }

  if (auth?.type === 'basic' && auth.basic?.username) {
    headers.set('authorization', `Basic ${encodeBasicAuth(auth.basic.username, auth.basic.password || '')}`);
    return url;
  }

  if (auth?.type === 'apikey' && auth.apikey?.key) {
    if (auth.apikey.in === 'query') {
      url.searchParams.set(auth.apikey.key, auth.apikey.value || '');
    } else {
      headers.set(auth.apikey.key, auth.apikey.value || '');
    }
  }

  return url;
}

function buildTargetHeaders(payload) {
  const headers = new Headers();

  (payload.headers || [])
    .filter((header) => header?.enabled !== false && header?.key)
    .forEach((header) => {
      try {
        headers.set(header.key, header.value ?? '');
      } catch (error) {
        throw createProxyError(`Invalid header "${header.key}": ${error.message}`, 400);
      }
    });

  AUTO_FORWARD_HEADERS.forEach(([key, value]) => {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  });

  return headers;
}

function buildTargetBody(payload, headers, method) {
  if (!methodAllowsBody(method)) {
    return undefined;
  }

  const body = payload.body || { mode: 'none' };

  if (body.mode === 'raw') {
    if (!headers.has('content-type')) {
      const contentTypeByLanguage = {
        json: 'application/json',
        xml: 'application/xml',
        html: 'text/html',
        text: 'text/plain',
      };

      headers.set('content-type', contentTypeByLanguage[body.rawLanguage] || 'text/plain');
    }

    return body.raw ?? '';
  }

  if (body.mode === 'form-data') {
    const formData = new FormData();

    (body.formData || [])
      .filter((item) => item?.enabled !== false && item?.key)
      .forEach((item) => {
        formData.append(item.key, item.value ?? '');
      });

    return formData;
  }

  if (body.mode === 'urlencoded') {
    const searchParams = new URLSearchParams();

    (body.urlencoded || [])
      .filter((item) => item?.enabled !== false && item?.key)
      .forEach((item) => {
        searchParams.append(item.key, item.value ?? '');
      });

    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
    }

    return searchParams.toString();
  }

  return undefined;
}

function isRedirectStatus(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

function buildRedirectState(response, state) {
  const location = response.headers.get('location');

  if (!location) {
    return null;
  }

  const nextUrl = new URL(location, state.url).toString();
  const nextHeaders = new Headers(state.headers);
  let nextMethod = state.method;
  let nextBody = state.body;

  if (
    response.status === 303 ||
    ((response.status === 301 || response.status === 302) && !['GET', 'HEAD'].includes(nextMethod))
  ) {
    nextMethod = 'GET';
    nextBody = undefined;
    nextHeaders.delete('content-type');
  }

  return {
    ...state,
    method: nextMethod,
    url: nextUrl,
    headers: nextHeaders,
    body: nextBody,
  };
}

async function fetchWithValidatedRedirects(state, maxRedirects = 5) {
  let currentState = state;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertPublicHttpUrl(currentState.url);

    const response = await fetch(currentState.url, {
      method: currentState.method,
      headers: currentState.headers,
      body: currentState.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(currentState.timeoutMs),
    });

    if (!isRedirectStatus(response.status)) {
      return response;
    }

    const nextState = buildRedirectState(response, currentState);

    if (!nextState) {
      return response;
    }

    currentState = nextState;
  }

  throw createProxyError('Too many redirects while executing the request.', 508);
}

export async function executeProxiedRequest(payload) {
  const method = (payload?.method || 'GET').toUpperCase();
  const timeoutMs = Math.min(Math.max(Number(payload?.timeoutMs) || 30_000, 1_000), 120_000);
  const headers = buildTargetHeaders(payload || {});
  const requestUrl = applyAuth(await assertPublicHttpUrl(payload?.url), headers, payload?.auth).toString();
  const body = buildTargetBody(payload || {}, headers, method);

  const start = Date.now();

  try {
    const response = await fetchWithValidatedRedirects({
      method,
      url: requestUrl,
      headers,
      body,
      timeoutMs,
    });

    const responseBody = await response.text();
    const responseHeaders = {};

    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      responseTimeMs: Date.now() - start,
      sizeBytes: Buffer.byteLength(responseBody, 'utf8'),
    };
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw createProxyError('Request timed out.', 504);
    }

    if (typeof error?.status === 'number') {
      throw error;
    }

    throw createProxyError(error?.message || 'Request proxy failed.', 502);
  }
}
