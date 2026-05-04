import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { syncService } from '@/services/syncService';
export const useEnvironmentStore = create(
  persist(
    (set, get) => ({
      environments: [],
      activeEnvironment: null,
      isLoading: false,
      error: null,

      // ── Fetch all environments for a project ──────────────────────────────
      fetchEnvironments: async (projectId, teamId, includeGlobal = false, manual = false) => {
        if (!projectId) return;
        set({ isLoading: true, error: null });
        try {
          const params = { projectId };
          if (teamId) params.teamId = teamId;
          if (includeGlobal) params.includeGlobal = 'true';

          const { data } = await api.get('/api/environment', { params });
          const envs = data.environments || [];
          set({ environments: envs, isLoading: false });

          if (manual) {
            toast.success('Environments synced from cloud');
          }

          // If active environment is from another project, clear it
          const active = get().activeEnvironment;
          if (active && !envs.find((e) => e._id === active._id)) {
            set({ activeEnvironment: null });
          }
        } catch (err) {
          const errorMsg = err.response?.data?.error || 'Failed to load environments';
          set({ isLoading: false, error: errorMsg });
          if (manual) {
            toast.error(errorMsg);
          }
        }
      },

      // ── Create environment ─────────────────────────────────────────────────
      createEnvironment: async (name, projectId, teamId, options = {}) => {
        const p = {
          name,
          projectId,
          teamId,
          description: options.description || '',
          color: options.color || '#6366f1',
          isGlobal: options.isGlobal || false,
          variables: options.variables || [],
        };

        const handleOfflineCreate = () => {
          const tempId = `temp_${uuidv4()}`;
          const mockEnv = { ...p, _id: tempId };
          syncService.queueChange('create_environment', mockEnv, tempId);
          set((state) => ({
            environments: [...state.environments, mockEnv],
          }));
          toast.success('Created locally (Sync pending)');
          return { success: true, environment: mockEnv, offline: true };
        };

        try {
          const { data } = await api.post('/api/environment', p);
          set((state) => ({
            environments: [...state.environments, data.environment],
          }));
          return { success: true, environment: data.environment };
        } catch (err) {
          const isNetError = !err.response && (err.code === 'ERR_NETWORK' || !navigator.onLine);
          if (isNetError) {
            return handleOfflineCreate();
          }
          return { success: false, error: err.response?.data?.error || 'Failed to create environment' };
        }
      },

      // ── Update environment (name, description, color) ─────────────────────
      updateEnvironment: async (id, updates) => {
        const handleOfflineUpdate = () => {
          syncService.queueChange('update_environment', { id, ...updates });
          set((state) => {
            const currentEnv = state.environments.find((e) => e._id === id);
            const updated = currentEnv ? { ...currentEnv, ...updates } : updates;
            return {
              environments: state.environments.map((e) => (e._id === id ? { ...e, ...updates } : e)),
              activeEnvironment:
                state.activeEnvironment?._id === id ? { ...state.activeEnvironment, ...updates } : state.activeEnvironment,
            };
          });
          toast.success('Updated locally (Sync pending)');
          return { success: true, offline: true };
        };

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
          const isNetError = !err.response && (err.code === 'ERR_NETWORK' || !navigator.onLine);
          if (isNetError) {
            return handleOfflineUpdate();
          }
          return { success: false, error: err.response?.data?.error || 'Failed to update' };
        }
      },

      // ── Save variables (bulk replace) ─────────────────────────────────────
      saveVariables: async (id, variables) => {
        const handleOfflineSave = () => {
          syncService.queueChange('update_environment_variables', { id, variables });
          set((state) => {
            const currentEnv = state.environments.find((e) => e._id === id);
            const updated = currentEnv ? { ...currentEnv, variables } : { variables };
            return {
              environments: state.environments.map((e) => (e._id === id ? { ...e, variables } : e)),
              activeEnvironment:
                state.activeEnvironment?._id === id ? { ...state.activeEnvironment, variables } : state.activeEnvironment,
            };
          });
          toast.success('Variables saved locally (Sync pending)');
          return { success: true, offline: true };
        };

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
          const isNetError = !err.response && (err.code === 'ERR_NETWORK' || !navigator.onLine);
          if (isNetError) {
            return handleOfflineSave();
          }
          return { success: false, error: err.response?.data?.error || 'Failed to save variables' };
        }
      },

      // ── Add a single variable ─────────────────────────────────────────────
      addVariable: async (envId, variable) => {
        const handleOfflineAdd = () => {
          syncService.queueChange('add_environment_variable', { envId, variable });
          set((state) => {
            const currentEnv = state.environments.find((e) => e._id === envId);
            const variables = currentEnv ? [...(currentEnv.variables || []), variable] : [variable];
            return {
              environments: state.environments.map((e) => (e._id === envId ? { ...e, variables } : e)),
              activeEnvironment:
                state.activeEnvironment?._id === envId ? { ...state.activeEnvironment, variables } : state.activeEnvironment,
            };
          });
          toast.success('Variable added locally (Sync pending)');
          return { success: true, variable, offline: true };
        };

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
          const isNetError = !err.response && (err.code === 'ERR_NETWORK' || !navigator.onLine);
          if (isNetError) {
            return handleOfflineAdd();
          }
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
        const handleOfflineDelete = () => {
          syncService.queueChange('delete_environment', { id });
          set((state) => ({
            environments: state.environments.filter((e) => e._id !== id),
            activeEnvironment: state.activeEnvironment?._id === id ? null : state.activeEnvironment,
          }));
          toast.success('Deleted locally (Sync pending)');
          return { success: true, offline: true };
        };

        try {
          await api.delete(`/api/environment/${id}`);
          set((state) => ({
            environments: state.environments.filter((e) => e._id !== id),
            activeEnvironment: state.activeEnvironment?._id === id ? null : state.activeEnvironment,
          }));
          return { success: true };
        } catch (err) {
          const isNetError = !err.response && (err.code === 'ERR_NETWORK' || !navigator.onLine);
          if (isNetError) {
            return handleOfflineDelete();
          }
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
