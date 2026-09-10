import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, {
  clearAuthTokens,
  persistAuthTokens,
  getStoredRefreshToken,
} from '@/lib/api';

function applySession(set, data, extras = {}) {
  const rememberMe = Boolean(
    extras.rememberMe ?? data.rememberMe ?? true,
  );
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
          // payload can be { accessToken } or { code, redirectUri }
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
          // Signup stages OTP — may not return tokens yet
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

        // 1. Disconnect Sockets first to clear presence on server
        try {
          const { useSocketStore } = await import('@/store/socketStore');
          useSocketStore.getState().disconnect();
        } catch (e) {
          console.error('[Logout] Socket disconnect failed:', e);
        }

        // 2. Clear Rust-side data (Cookies, etc)
        try {
          const { invoke } = await import('@tauri-apps/api/tauri');
          await invoke('clear_cookies');
        } catch (e) {
          console.error('[Logout] Tauri cleanup failed:', e);
        }

        // 3. Clear Sync mappings
        try {
          const { syncService } = await import('@/services/syncService');
          syncService.clearIdMappings();
        } catch (e) {
          console.error('[Logout] Sync cleanup failed:', e);
        }

        // 4. Clear auth tokens + storage
        clearAuthTokens();
        localStorage.clear();
        sessionStorage.clear();

        // 5. Reset all memory stores to initial state
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

        set({ user: null, token: null, refreshToken: null });
      },

      fetchMe: async () => {
        const token = localStorage.getItem('payloadx_token');
        if (!token && !getStoredRefreshToken()) return;

        if (!navigator.onLine) {
          // App initialized without an internet connection,
          // simply rely on persisted zustand state rather than kicking them out.
          return;
        }

        try {
          const { data } = await api.get('/api/auth/me');
          set({
            user: data.user,
            token: localStorage.getItem('payloadx_token'),
            refreshToken: getStoredRefreshToken(),
          });
        } catch (err) {
          // If the internet drops the instant the request fires
          if (err.message === 'Network Error' || err.code === 'ERR_NETWORK' || !navigator.onLine) {
            return;
          }

          // api interceptor already attempted refresh; if still failing, clear session
          clearAuthTokens();
          set({ user: null, token: null, refreshToken: null });
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
      // Only persist session across restarts when "Remember me" is on
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
      },
    }
  )
);
