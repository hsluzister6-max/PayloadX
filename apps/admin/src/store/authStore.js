import { create } from 'zustand';
import api, {
  setToken,
  getToken,
  setRefreshToken,
  getRefreshToken,
  clearAuth,
  setApiBaseUrl,
  getApiBaseUrl,
} from '../lib/api';

function applyAdminSession(set, data) {
  if (!data?.user?.isPlatformAdmin) {
    clearAuth();
    set({
      isLoading: false,
      error:
        'This account is not a platform admin. Only sundansharma600@gmail.com (and ADMIN_EMAILS) can access.',
      user: null,
      token: null,
      refreshToken: null,
    });
    return { success: false };
  }

  setToken(data.token);
  if (data.refreshToken) setRefreshToken(data.refreshToken);

  set({
    user: data.user,
    token: data.token,
    refreshToken: data.refreshToken || getRefreshToken(),
    apiUrl: getApiBaseUrl(),
    isLoading: false,
    error: null,
  });
  return { success: true };
}

export const useAuthStore = create((set) => ({
  user: null,
  token: getToken(),
  refreshToken: getRefreshToken(),
  apiUrl: getApiBaseUrl(),
  isLoading: false,
  error: null,

  login: async (email, password, apiUrl) => {
    set({ isLoading: true, error: null });
    try {
      if (apiUrl) setApiBaseUrl(apiUrl);
      const { data } = await api.post('/api/auth/login', {
        email,
        password,
        rememberMe: true,
      });
      return applyAdminSession(set, data);
    } catch (err) {
      const error = err.response?.data?.error || err.message || 'Login failed';
      set({ isLoading: false, error, user: null, token: null, refreshToken: null });
      return { success: false, error };
    }
  },

  loginWithGoogle: async (accessToken, apiUrl) => {
    set({ isLoading: true, error: null });
    try {
      if (apiUrl) setApiBaseUrl(apiUrl);
      const token =
        typeof accessToken === 'string'
          ? accessToken
          : accessToken?.access_token || accessToken?.accessToken;
      if (!token) {
        set({ isLoading: false, error: 'Missing Google access token' });
        return { success: false };
      }
      const { data } = await api.post('/api/auth/google', { accessToken: token });
      return applyAdminSession(set, data);
    } catch (err) {
      const error = err.response?.data?.error || err.message || 'Google login failed';
      set({ isLoading: false, error, user: null, token: null, refreshToken: null });
      return { success: false, error };
    }
  },

  fetchMe: async () => {
    if (!getToken() && !getRefreshToken()) {
      set({ user: null, token: null, refreshToken: null });
      return null;
    }
    set({ isLoading: true });
    try {
      const { data } = await api.get('/api/auth/me');
      if (!data?.user?.isPlatformAdmin) {
        clearAuth();
        set({ user: null, token: null, refreshToken: null, isLoading: false, error: 'Not a platform admin' });
        return null;
      }
      set({
        user: data.user,
        token: getToken(),
        refreshToken: getRefreshToken(),
        isLoading: false,
        error: null,
      });
      return data.user;
    } catch (err) {
      // Network / refresh failure that kept tokens → keep trying later
      if (!err.response || !navigator.onLine) {
        set({ isLoading: false });
        return getToken() ? { offline: true } : null;
      }
      if (!getRefreshToken()) {
        clearAuth();
        set({ user: null, token: null, refreshToken: null, isLoading: false });
      } else {
        set({ isLoading: false });
      }
      return null;
    }
  },

  logout: async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) {
        await api.post('/api/auth/logout', { refreshToken });
      }
    } catch {
      /* ignore */
    }
    clearAuth();
    set({ user: null, token: null, refreshToken: null, error: null });
  },
}));
