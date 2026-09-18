import { create } from 'zustand';
import api, { setToken, getToken, setApiBaseUrl, getApiBaseUrl } from '../lib/api';

function applyAdminSession(set, data) {
  if (!data?.user?.isPlatformAdmin) {
    setToken(null);
    set({
      isLoading: false,
      error:
        'This account is not a platform admin. Only sundansharma600@gmail.com (and ADMIN_EMAILS) can access.',
      user: null,
      token: null,
    });
    return { success: false };
  }

  setToken(data.token);
  set({
    user: data.user,
    token: data.token,
    apiUrl: getApiBaseUrl(),
    isLoading: false,
    error: null,
  });
  return { success: true };
}

export const useAuthStore = create((set) => ({
  user: null,
  token: getToken(),
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
      set({ isLoading: false, error, user: null, token: null });
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
      set({ isLoading: false, error, user: null, token: null });
      return { success: false, error };
    }
  },

  fetchMe: async () => {
    if (!getToken()) {
      set({ user: null, token: null });
      return null;
    }
    set({ isLoading: true });
    try {
      const { data } = await api.get('/api/auth/me');
      if (!data?.user?.isPlatformAdmin) {
        setToken(null);
        set({ user: null, token: null, isLoading: false, error: 'Not a platform admin' });
        return null;
      }
      set({ user: data.user, token: getToken(), isLoading: false, error: null });
      return data.user;
    } catch {
      setToken(null);
      set({ user: null, token: null, isLoading: false });
      return null;
    }
  },

  logout: () => {
    setToken(null);
    set({ user: null, token: null, error: null });
  },
}));
