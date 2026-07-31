import { create } from 'zustand';
import api from '@/lib/api';
import { useConnectivityStore } from '@/store/connectivityStore';

export const useDashboardStore = create((set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  lastFetchedAt: null,
  lastKey: null,

  fetchDashboard: async (teamId, projectId, { force = false } = {}) => {
    if (!teamId) {
      set({ data: null, error: 'Select a team to load analytics', isLoading: false });
      return { success: false, error: 'teamId required' };
    }

    const key = `${teamId}:${projectId || 'all'}`;
    const { lastKey, lastFetchedAt, isLoading } = get();
    const fresh = lastFetchedAt && Date.now() - lastFetchedAt < 30_000;
    if (!force && isLoading) return { success: true, cached: true };
    if (!force && lastKey === key && fresh && get().data) {
      return { success: true, cached: true, data: get().data };
    }

    const online = useConnectivityStore.getState().hasInternet ?? navigator.onLine;
    if (!online) {
      set({ error: 'Offline — showing local estimates when available', isLoading: false });
      return { success: false, error: 'offline' };
    }

    set({ isLoading: true, error: null, lastKey: key });
    try {
      const { data } = await api.get('/api/dashboard', {
        params: { teamId, projectId: projectId || undefined },
      });
      set({
        data,
        isLoading: false,
        error: null,
        lastFetchedAt: Date.now(),
        lastKey: key,
      });
      return { success: true, data };
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to load dashboard';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  logRun: async (payload) => {
    if (!payload?.teamId) return { success: false };
    const online = useConnectivityStore.getState().hasInternet ?? navigator.onLine;
    if (!online) return { success: false, error: 'offline' };

    try {
      await api.post('/api/dashboard/runs', payload, {
        // Don't trigger global 401 logout loops for background analytics
        syncContext: true,
        timeout: 8000,
      });
      // Soft-invalidate cache so next dashboard open refreshes
      set({ lastFetchedAt: null });
      return { success: true };
    } catch (err) {
      console.warn('[dashboard] logRun failed', err?.message || err);
      return { success: false, error: err.message };
    }
  },

  reset: () => set({ data: null, isLoading: false, error: null, lastFetchedAt: null, lastKey: null }),
}));
