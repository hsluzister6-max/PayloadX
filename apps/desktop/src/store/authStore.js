import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, {
  clearAuthTokens,
  persistAuthTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
} from '@/lib/api';

function applySession(set, data, extras = {}) {
  const rememberMe = Boolean(extras.rememberMe ?? data.rememberMe ?? true);
  persistAuthTokens(
    {
      token: data.token,
      refreshToken: data.refreshToken,
    },
    { rememberMe },
  );
  set({
    user: data.user,
    token: data.token,
    refreshToken: data.refreshToken || null,
    rememberMe,
    isLoading: false,
    error: null,
    ...extras,
    rememberMe,
  });
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      rememberMe: true,
      isLoading: false,
      error: null,
      hydrated: false,

      login: async (email, password, rememberMe = true) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post('/api/auth/login', {
            email,
            password,
            rememberMe: Boolean(rememberMe),
          });
          applySession(set, data, { rememberMe: Boolean(rememberMe) });
          return { success: true };
        } catch (err) {
          const error = err.response?.data?.error || 'Login failed';
          set({ isLoading: false, error });
          return { success: false, error };
        }
      },

      loginWithGoogle: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const body = typeof payload === 'string' ? { accessToken: payload } : payload;
          const { data } = await api.post('/api/auth/google', body);
          applySession(set, data, { rememberMe: true });
          return { success: true };
        } catch (err) {
          const error = err.response?.data?.error || 'Google login failed';
          set({ isLoading: false, error });
          return { success: false, error };
        }
      },

      signup: async (name, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post('/api/auth/signup', { name, email, password });
          if (data?.token) {
            applySession(set, data, { rememberMe: true });
          } else {
            set({ isLoading: false });
          }
          return { success: true, ...data };
        } catch (err) {
          const error = err.response?.data?.error || 'Signup failed';
          set({ isLoading: false, error });
          return { success: false, error };
        }
      },

      logout: async () => {
        const refreshToken = get().refreshToken || getStoredRefreshToken();

        // Best-effort server revoke so the refresh token can't be reused
        try {
          if (refreshToken) {
            await api.post('/api/auth/logout', { refreshToken });
          }
        } catch {
          /* ignore network errors during logout */
        }

        try {
          const { useSocketStore } = await import('@/store/socketStore');
          useSocketStore.getState().disconnect();
        } catch (e) {
          console.error('[Logout] Socket disconnect failed:', e);
        }

        try {
          const { invoke } = await import('@tauri-apps/api/tauri');
          await invoke('clear_all_cookie_sessions');
        } catch (e) {
          console.error('[Logout] Tauri cleanup failed:', e);
        }

        try {
          const { syncService } = await import('@/services/syncService');
          syncService.clearIdMappings();
        } catch (e) {
          console.error('[Logout] Sync cleanup failed:', e);
        }

        // Clear auth keys only — never wipe entire localStorage
        clearAuthTokens();
        try {
          localStorage.removeItem('syncnest-auth');
        } catch {
          /* ignore */
        }

        try {
          const { useCollectionStore } = await import('@/store/collectionStore');
          const { useProjectStore } = await import('@/store/projectStore');
          const { useTeamStore } = await import('@/store/teamStore');
          const { useRequestStore } = await import('@/store/requestStore');
          const { useWorkflowStore } = await import('@/store/workflowStore');
          const { useUIStore } = await import('@/store/uiStore');
          const { useEnvironmentStore } = await import('@/store/environmentStore');
          const { useSyncQueueStore } = await import('@/store/syncQueueStore');
          const { useWSStore } = await import('@/store/wsStore');
          const { useSIOStore } = await import('@/store/sioStore');

          useCollectionStore.getState().reset();
          useProjectStore.getState().reset();
          useTeamStore.getState().reset();
          useRequestStore.getState().reset();
          useWorkflowStore.getState().reset();
          useUIStore.getState().reset();
          useEnvironmentStore.getState().reset();
          useWSStore.getState().reset();
          useSIOStore.getState().reset();
          useSyncQueueStore.getState().clearQueue();
        } catch (e) {
          console.error('[Logout] Store reset failed:', e);
        }

        set({
          user: null,
          token: null,
          refreshToken: null,
          rememberMe: true,
          error: null,
        });
      },

      fetchMe: async () => {
        const access = getStoredAccessToken();
        const refresh = getStoredRefreshToken();
        if (!access && !refresh) return;

        if (!navigator.onLine) {
          // Offline: keep persisted session; do not force logout
          return;
        }

        try {
          const { data } = await api.get('/api/auth/me');
          set({
            user: data.user,
            token: getStoredAccessToken(),
            refreshToken: getStoredRefreshToken(),
          });
        } catch (err) {
          // Network / timeout — keep session
          if (
            !err.response ||
            err.message === 'Network Error' ||
            err.code === 'ERR_NETWORK' ||
            err.code === 'ECONNABORTED' ||
            !navigator.onLine
          ) {
            return;
          }

          // Interceptor already tried refresh. If refresh token still exists,
          // keep UI session (transient server error). Only clear when both gone.
          if (!getStoredRefreshToken() && !getStoredAccessToken()) {
            set({ user: null, token: null, refreshToken: null });
          }
        }
      },

      forgotPassword: async (email) => {
        set({ isLoading: true, error: null });
        try {
          await api.post('/api/auth/forgot-password', { email });
          set({ isLoading: false });
          return { success: true };
        } catch (err) {
          const error = err.response?.data?.error || 'Failed to send OTP';
          set({ isLoading: false, error });
          return { success: false, error };
        }
      },

      resetPasswordOtp: async (email, otp, newPassword) => {
        set({ isLoading: true, error: null });
        try {
          await api.post('/api/auth/reset-password-otp', { email, otp, newPassword });
          set({ isLoading: false });
          return { success: true };
        } catch (err) {
          const error = err.response?.data?.error || 'Failed to reset password';
          set({ isLoading: false, error });
          return { success: false, error };
        }
      },

      verifyOtp: async (email, otp) => {
        set({ isLoading: true, error: null });
        try {
          await api.post('/api/auth/verify-otp', { email, otp });
          set({ isLoading: false });
          return { success: true };
        } catch (err) {
          const error = err.response?.data?.error || 'Invalid or expired code';
          set({ isLoading: false, error });
          return { success: false, error };
        }
      },

      verifySignup: async (email, otp) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post('/api/auth/verify-signup', { email, otp });
          applySession(set, data, { rememberMe: true });
          return { success: true };
        } catch (err) {
          const error = err.response?.data?.error || 'Invalid or expired verification code';
          set({ isLoading: false, error });
          return { success: false, error };
        }
      },
    }),
    {
      name: 'syncnest-auth',
      // Persist session across restarts when "Remember me" is on (default)
      partialize: (state) =>
        state.rememberMe
          ? {
              user: state.user,
              token: state.token,
              refreshToken: state.refreshToken,
              rememberMe: true,
            }
          : { rememberMe: false },
      onRehydrateStorage: () => (state) => {
        if (state?.rememberMe && (state?.token || state?.refreshToken)) {
          persistAuthTokens(
            {
              token: state.token,
              refreshToken: state.refreshToken,
            },
            { rememberMe: true },
          );
        }
        useAuthStore.setState({ hydrated: true });
      },
    }
  )
);
