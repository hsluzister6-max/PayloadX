
import axios from 'axios';
import { useSyncQueueStore } from '@/store/syncQueueStore';

// const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_URL = import.meta.env.VITE_API_URL || 'https://payloadx-ykjd.onrender.com';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject JWT token
api.interceptors.request.use((config) => {
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
