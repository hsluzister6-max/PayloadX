import axios from 'axios';
import { useServerConfigStore } from '@/store/serverConfigStore';

const PAYLOADX_SERVER_URL = 'https://payloadx-ykjd.onrender.com';

// Dynamically read the base URL from the persisted store each request
const getBaseUrl = () => {
  const { serverMode, customUrl } = useServerConfigStore.getState();
  if (serverMode === 'local') {
    return customUrl?.replace(/\/$/, '') || 'http://localhost:3001';
  }
  return PAYLOADX_SERVER_URL;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Update baseURL on every request so it reflects the current saved config
api.interceptors.request.use((config) => {
  config.baseURL = getBaseUrl();

  const token = localStorage.getItem('payloadx_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't logout if this is a background sync operation
      // Let syncService handle the error gracefully
      if (error.config?.isSyncOperation || error.config?.syncContext) {
        return Promise.reject(error);
      }
      // Inform the user and log them out cleanly (prevents infinite refresh loops)
      import('@/store/authStore').then(({ useAuthStore }) => {
        const store = useAuthStore.getState();
        if (store.user || localStorage.getItem('payloadx_token')) {
          store.logout();
        }
      });
      return Promise.reject(error);
    }

    // If offline, we just reject immediately. Stores now handle the "You are offline" toast
    // before even calling the API.
    if (!navigator.onLine) {
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;
