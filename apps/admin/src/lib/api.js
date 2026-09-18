import axios from 'axios';
import { DEFAULT_API_URL } from '../config';

const TOKEN_KEY = 'payloadx_admin_token';
const API_URL_KEY = 'payloadx_admin_api_url';

export function getApiBaseUrl() {
  return (localStorage.getItem(API_URL_KEY) || DEFAULT_API_URL).replace(/\/$/, '');
}

export function setApiBaseUrl(url) {
  localStorage.setItem(API_URL_KEY, String(url || '').replace(/\/$/, ''));
  api.defaults.baseURL = getApiBaseUrl();
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      setToken(null);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

export default api;
