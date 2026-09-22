import axios from 'axios';
import { DEFAULT_API_URL } from '../config';

const ACCESS_TOKEN_KEY = 'payloadx_admin_token';
const REFRESH_TOKEN_KEY = 'payloadx_admin_refresh_token';
const API_URL_KEY = 'payloadx_admin_api_url';

export function getApiBaseUrl() {
  return (localStorage.getItem(API_URL_KEY) || DEFAULT_API_URL || '').replace(/\/$/, '');
}

export function setApiBaseUrl(url) {
  localStorage.setItem(API_URL_KEY, String(url || '').replace(/\/$/, ''));
  api.defaults.baseURL = getApiBaseUrl();
}

export function getToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
  else localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function setRefreshToken(token) {
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
  else localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function clearAuth() {
  setToken(null);
  setRefreshToken(null);
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise = null;

function isNetworkError(err) {
  if (!err) return false;
  if (!err.response) return true;
  return err.code === 'ERR_NETWORK' || err.message === 'Network Error' || !navigator.onLine;
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    const err = new Error('No refresh token');
    err.code = 'REFRESH_MISSING';
    throw err;
  }

  const { data } = await axios.post(
    `${getApiBaseUrl()}/api/auth/refresh`,
    { refreshToken },
    { timeout: 15000, headers: { 'Content-Type': 'application/json' } },
  );

  setToken(data.token);
  if (data.refreshToken) setRefreshToken(data.refreshToken);
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

api.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    const original = err.config;

    if (status !== 401 || !original || original._retry) {
      return Promise.reject(err);
    }

    const url = String(original.url || '');
    if (
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/refresh') ||
      url.includes('/api/auth/google') ||
      url.includes('/api/auth/logout')
    ) {
      return Promise.reject(err);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearAuth();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(err);
    }

    try {
      original._retry = true;
      const newToken = await refreshSessionSingleFlight();
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshError) {
      if (isNetworkError(refreshError)) {
        return Promise.reject(refreshError);
      }
      clearAuth();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    }
  },
);

export default api;
