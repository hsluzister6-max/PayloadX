import axios from 'axios';
import { getServerBaseUrl } from '@/store/serverConfigStore';

const ACCESS_TOKEN_KEY = 'payloadx_token';
const REFRESH_TOKEN_KEY = 'payloadx_refresh_token';
const REMEMBER_ME_KEY = 'payloadx_remember_me';

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
 * rememberMe=true → localStorage (survives app restart)
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

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(REMEMBER_ME_KEY);
}

async function refreshAccessToken() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token');
  }

  // Use a bare axios call so we don't recurse through the 401 interceptor.
  const { data } = await axios.post(
    `${getServerBaseUrl()}/api/auth/refresh`,
    { refreshToken },
    { timeout: 15000, headers: { 'Content-Type': 'application/json' } },
  );

  persistAuthTokens({
    token: data.token,
    refreshToken: data.refreshToken,
  });

  try {
    const { useAuthStore } = await import('@/store/authStore');
    useAuthStore.setState({
      token: data.token,
      refreshToken: data.refreshToken,
      user: data.user || useAuthStore.getState().user,
      rememberMe:
        typeof data.rememberMe === 'boolean'
          ? data.rememberMe
          : useAuthStore.getState().rememberMe,
    });
  } catch {
    /* store may not be ready */
  }

  return data.token;
}

function refreshSessionSingleFlight() {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// Update baseURL on every request so it reflects the current saved config
api.interceptors.request.use((config) => {
  config.baseURL = getServerBaseUrl();

  const token = getStoredAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401: try refresh once, then retry. Only logout if refresh fails.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const original = error.config;

    if (status !== 401 || !original) {
      if (!navigator.onLine) return Promise.reject(error);
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
      import('@/store/authStore').then(({ useAuthStore }) => {
        const store = useAuthStore.getState();
        if (store.user || getStoredAccessToken()) {
          store.logout();
        }
      });
      return Promise.reject(error);
    }

    try {
      original._retry = true;
      const newToken = await refreshSessionSingleFlight();
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshError) {
      import('@/store/authStore').then(({ useAuthStore }) => {
        const store = useAuthStore.getState();
        if (store.user || getStoredAccessToken() || getStoredRefreshToken()) {
          store.logout();
        }
      });
      return Promise.reject(refreshError);
    }
  },
);

export default api;
