import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

export const useEnvironmentStore = create(
  persist(
    (set, get) => ({
      environments: [],
      activeEnvironment: null,
      isLoading: false,
      error: null,

      // ── Fetch all environments for a project ──────────────────────────────
      fetchEnvironments: async (projectId, teamId, includeGlobal = false) => {
        if (!projectId) return;
        set({ isLoading: true, error: null });
        try {
          const params = { projectId };
          if (teamId) params.teamId = teamId;
          if (includeGlobal) params.includeGlobal = 'true';

          const { data } = await api.get('/api/environment', { params });
          const envs = data.environments || [];
          set({ environments: envs, isLoading: false });

          // If active environment is from another project, clear it
          const active = get().activeEnvironment;
          if (active && !envs.find((e) => e._id === active._id)) {
            set({ activeEnvironment: null });
          }
        } catch (err) {
          set({ isLoading: false, error: err.response?.data?.error || 'Failed to load environments' });
        }
      },

      // ── Create environment ─────────────────────────────────────────────────
      createEnvironment: async (name, projectId, teamId, options = {}) => {
        if (!navigator.onLine) {
          toast.error('You are offline. Cannot create environment.');
          return { success: false, error: 'Offline' };
        }

        try {
          const p = {
            name,
            projectId,
            teamId,
            description: options.description || '',
            color: options.color || '#6366f1',
            isGlobal: options.isGlobal || false,
            variables: options.variables || [],
          };
          const { data } = await api.post('/api/environment', p);
          set((state) => ({
            environments: [...state.environments, data.environment],
          }));
          return { success: true, environment: data.environment };
        } catch (err) {
          return { success: false, error: err.response?.data?.error || 'Failed to create environment' };
        }
      },

      // ── Update environment (name, description, color) ─────────────────────
      updateEnvironment: async (id, updates) => {
        if (!navigator.onLine) {
          toast.error('You are offline. Cannot update environment.');
          return { success: false, error: 'Offline' };
        }

        try {
          const { data } = await api.put(`/api/environment/${id}`, updates);
          const updated = data.environment;
          set((state) => ({
            environments: state.environments.map((e) => (e._id === id ? updated : e)),
            activeEnvironment:
              state.activeEnvironment?._id === id ? updated : state.activeEnvironment,
          }));
          return { success: true, environment: updated };
        } catch (err) {
          return { success: false, error: err.response?.data?.error || 'Failed to update' };
        }
      },

      // ── Save variables (bulk replace) ─────────────────────────────────────
      saveVariables: async (id, variables) => {
        if (!navigator.onLine) {
          toast.error('You are offline. Cannot save variables.');
          return { success: false, error: 'Offline' };
        }

        try {
          const { data } = await api.put(`/api/environment/${id}/variables`, { variables });
          const updated = data.environment;
          set((state) => ({
            environments: state.environments.map((e) => (e._id === id ? updated : e)),
            activeEnvironment:
              state.activeEnvironment?._id === id ? updated : state.activeEnvironment,
          }));
          return { success: true, environment: updated };
        } catch (err) {
          return { success: false, error: err.response?.data?.error || 'Failed to save variables' };
        }
      },

      // ── Add a single variable ─────────────────────────────────────────────
      addVariable: async (envId, variable) => {
        if (!navigator.onLine) {
          toast.error('You are offline. Cannot add variable.');
          return { success: false, error: 'Offline' };
        }

        try {
          const { data } = await api.post(`/api/environment/${envId}/variables`, variable);
          // Refresh the environment
          const { data: envData } = await api.get(`/api/environment/${envId}`);
          const updated = envData.environment;
          set((state) => ({
            environments: state.environments.map((e) => (e._id === envId ? updated : e)),
            activeEnvironment:
              state.activeEnvironment?._id === envId ? updated : state.activeEnvironment,
          }));
          return { success: true, variable: data.variable };
        } catch (err) {
          return { success: false, error: err.response?.data?.error || 'Failed to add variable' };
        }
      },

      // ── Duplicate environment ─────────────────────────────────────────────
      duplicateEnvironment: async (id, newName) => {
        if (!navigator.onLine) {
          toast.error('You are offline. Cannot duplicate environment.');
          return { success: false, error: 'Offline' };
        }

        try {
          const { data } = await api.post(`/api/environment/${id}/duplicate`, { name: newName });
          set((state) => ({
            environments: [...state.environments, data.environment],
          }));
          return { success: true, environment: data.environment };
        } catch (err) {
          return { success: false, error: err.response?.data?.error || 'Failed to duplicate' };
        }
      },

      // ── Delete environment ─────────────────────────────────────────────────
      deleteEnvironment: async (id) => {
        if (!navigator.onLine) {
          toast.error('You are offline. Cannot delete environment.');
          return { success: false, error: 'Offline' };
        }

        try {
          await api.delete(`/api/environment/${id}`);
          set((state) => ({
            environments: state.environments.filter((e) => e._id !== id),
            activeEnvironment: state.activeEnvironment?._id === id ? null : state.activeEnvironment,
          }));
          return { success: true };
        } catch (err) {
          return { success: false, error: err.response?.data?.error || 'Failed to delete' };
        }
      },

      // ── Set active environment ─────────────────────────────────────────────
      setActiveEnvironment: (env) => set({ activeEnvironment: env }),

      // ── Resolve {{variable}} syntax against active environment ─────────────
      resolveVariables: (text) => {
        const env = get().activeEnvironment;
        if (!env || !text || typeof text !== 'string') return text;

        return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
          const trimmedKey = key.trim();
          const variable = env.variables?.find(
            (v) => v.key === trimmedKey && v.enabled !== false
          );
          return variable ? variable.value : match;
        });
      },

      // ── Get list of all defined variable names for autocomplete ───────────
      getVariableKeys: () => {
        const env = get().activeEnvironment;
        if (!env) return [];
        return env.variables
          .filter((v) => v.enabled !== false && v.key)
          .map((v) => v.key);
      },

      clearError: () => set({ error: null }),

      reset: () => {
        set({
          environments: [],
          activeEnvironment: null,
          isLoading: false,
          error: null
        });
      }
    }),
    {
      name: 'syncnest-environment',
      // Only persist the active environment selection — not the full list
      partialize: (state) => ({ activeEnvironment: state.activeEnvironment }),
    }
  )
);
