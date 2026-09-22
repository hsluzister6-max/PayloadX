import axios from 'axios';
import { getServerBaseUrl } from '@/store/serverConfigStore';

const ACCESS_TOKEN_KEY = 'payloadx_token';
const REFRESH_TOKEN_KEY = 'payloadx_refresh_token';
const REMEMBER_ME_KEY = 'payloadx_remember_me';
const REFRESH_LOCK_KEY = 'payloadx_refresh_lock';
const REFRESH_RESULT_KEY = 'payloadx_refresh_result';

const api = axios.create({
  baseURL: getServerBaseUrl(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise = null;

function readToken(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
}

export function getStoredAccessToken() {
  return readToken(ACCESS_TOKEN_KEY);
}

export function getStoredRefreshToken() {
  return readToken(REFRESH_TOKEN_KEY);
}

export function isRememberMeEnabled() {
  const flag = localStorage.getItem(REMEMBER_ME_KEY);
  if (flag == null) return true;
  return flag === '1';
}

/**
 * Persist access + refresh tokens.
 * rememberMe=true → localStorage (survives app restart) — default for one-time login
 * rememberMe=false → sessionStorage (cleared when the window closes)
 */
export function persistAuthTokens({ token, refreshToken }, { rememberMe } = {}) {
  const remember =
    typeof rememberMe === 'boolean' ? rememberMe : isRememberMeEnabled();

  localStorage.setItem(REMEMBER_ME_KEY, remember ? '1' : '0');

  const primary = remember ? localStorage : sessionStorage;
  const secondary = remember ? sessionStorage : localStorage;

  secondary.removeItem(ACCESS_TOKEN_KEY);
  secondary.removeItem(REFRESH_TOKEN_KEY);

  if (token) primary.setItem(ACCESS_TOKEN_KEY, token);
  if (refreshToken) primary.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

/** Clear only auth keys — never wipe the whole browser storage. */
export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(REMEMBER_ME_KEY);
  localStorage.removeItem(REFRESH_LOCK_KEY);
  localStorage.removeItem(REFRESH_RESULT_KEY);
}

function isNetworkError(err) {
  if (!err) return false;
  if (!err.response) return true;
  return (
    err.code === 'ERR_NETWORK' ||
    err.code === 'ECONNABORTED' ||
    err.message === 'Network Error' ||
    !navigator.onLine
  );
}

function isInvalidRefreshError(err) {
  const status = err?.response?.status;
  const code = err?.response?.data?.code;
  if (status === 401) return true;
  return code === 'REFRESH_INVALID' || code === 'REFRESH_MISSING';
}

async function syncAuthStore(data) {
  try {
    const { useAuthStore } = await import('@/store/authStore');
    useAuthStore.setState({
      token: data.token,
      refreshToken: data.refreshToken ?? useAuthStore.getState().refreshToken,
      user: data.user || useAuthStore.getState().user,
      rememberMe:
        typeof data.rememberMe === 'boolean'
          ? data.rememberMe
          : useAuthStore.getState().rememberMe,
    });
  } catch {
    /* store may not be ready */
  }
}

async function refreshAccessToken() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    const err = new Error('No refresh token');
    err.code = 'REFRESH_MISSING';
    throw err;
  }

  // Bare axios so we don't recurse through the 401 interceptor.
  const { data } = await axios.post(
    `${getServerBaseUrl()}/api/auth/refresh`,
    { refreshToken },
    { timeout: 15000, headers: { 'Content-Type': 'application/json' } },
  );

  persistAuthTokens(
    {
      token: data.token,
      refreshToken: data.refreshToken || refreshToken,
    },
    {
      rememberMe:
        typeof data.rememberMe === 'boolean' ? data.rememberMe : undefined,
    },
  );

  try {
    localStorage.setItem(
      REFRESH_RESULT_KEY,
      JSON.stringify({
        token: data.token,
        refreshToken: data.refreshToken || refreshToken,
        at: Date.now(),
      }),
    );
  } catch {
    /* ignore quota */
  }

  await syncAuthStore({
    ...data,
    refreshToken: data.refreshToken || refreshToken,
  });

  return data.token;
}

async function withCrossWindowLock(fn) {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('payloadx-auth-refresh', fn);
  }

  // Fallback lock for environments without Web Locks API
  const lockId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const now = Date.now();
  try {
    const raw = localStorage.getItem(REFRESH_LOCK_KEY);
    const lock = raw ? JSON.parse(raw) : null;
    if (lock?.id && now - (lock.at || 0) < 12_000 && lock.id !== lockId) {
      // Another tab is refreshing — wait briefly for its result
      await new Promise((r) => setTimeout(r, 600));
      const resultRaw = localStorage.getItem(REFRESH_RESULT_KEY);
      if (resultRaw) {
        const result = JSON.parse(resultRaw);
        if (result?.token && Date.now() - (result.at || 0) < 15_000) {
          persistAuthTokens({
            token: result.token,
            refreshToken: result.refreshToken || getStoredRefreshToken(),
          });
          await syncAuthStore(result);
          return result.token;
        }
      }
    }
    localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify({ id: lockId, at: now }));
  } catch {
    /* ignore */
  }

  try {
    return await fn();
  } finally {
    try {
      const raw = localStorage.getItem(REFRESH_LOCK_KEY);
      const lock = raw ? JSON.parse(raw) : null;
      if (lock?.id === lockId) localStorage.removeItem(REFRESH_LOCK_KEY);
    } catch {
      /* ignore */
    }
  }
}

function refreshSessionSingleFlight() {
  if (!refreshPromise) {
    refreshPromise = withCrossWindowLock(refreshAccessToken).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function forceLogout() {
  try {
    const { useAuthStore } = await import('@/store/authStore');
    const store = useAuthStore.getState();
    if (store.user || getStoredAccessToken() || getStoredRefreshToken()) {
      await store.logout();
    }
  } catch {
    clearAuthTokens();
  }
}

// Update baseURL on every request so it reflects the current saved config
api.interceptors.request.use((config) => {
  config.baseURL = getServerBaseUrl();

  const token = getStoredAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401: try refresh once, then retry.
// Only logout on definitive invalid refresh — never on network blips.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const original = error.config;

    if (status !== 401 || !original) {
      return Promise.reject(error);
    }

    // Don't logout / refresh for sync ops — they handle errors themselves
    if (original.isSyncOperation || original.syncContext) {
      return Promise.reject(error);
    }

    // Avoid infinite loop on auth endpoints
    const url = String(original.url || '');
    if (
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/refresh') ||
      url.includes('/api/auth/logout') ||
      url.includes('/api/auth/signup') ||
      url.includes('/api/auth/google') ||
      original._retry
    ) {
      return Promise.reject(error);
    }

    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      // No session to renew — only clear if we thought we were logged in
      if (getStoredAccessToken()) {
        await forceLogout();
      }
      return Promise.reject(error);
    }

    try {
      original._retry = true;
      const newToken = await refreshSessionSingleFlight();
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshError) {
      if (isNetworkError(refreshError)) {
        // Keep session; caller can retry when online
        return Promise.reject(refreshError);
      }
      if (isInvalidRefreshError(refreshError)) {
        await forceLogout();
      }
      return Promise.reject(refreshError);
    }
  },
);

export default api;
