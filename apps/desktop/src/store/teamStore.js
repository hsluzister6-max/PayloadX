import { create } from 'zustand';
import api from '@/lib/api';
import { localStorageService } from '@/services/localStorageService';
import { syncService } from '@/services/syncService';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

export const useTeamStore = create((set, get) => ({
  teams: localStorageService.get(localStorageService.KEYS.TEAMS) || [],
  currentTeam: localStorageService.get(localStorageService.KEYS.CURRENT_TEAM) || null,
  isLoading: false,
  isRefreshing: false,
  pendingChanges: [],

  initFromStorage: () => {
    const stored = localStorageService.get(localStorageService.KEYS.TEAMS);
    const current = localStorageService.get(localStorageService.KEYS.CURRENT_TEAM);
    if (stored) set({ teams: stored });
    if (current) set({ currentTeam: current });
  },

  fetchTeams: async (forceRefresh = false) => {
    // If not forcing refresh and we already have teams, just return
    if (!forceRefresh && get().teams.length > 0) {
      return { success: true, teams: get().teams, fromCache: true };
    }

    set({ isLoading: true });
    try {
      const { data } = await api.get('/api/team');
      if (data?.teams) {
        const syncedTeams = get().syncWithServerData(data.teams);

        set({ teams: syncedTeams, isLoading: false });
        localStorageService.saveTeams(syncedTeams);
        localStorageService.updateLastSync();

        return { success: true, teams: syncedTeams, fromCache: false };
      }
      throw new Error('No teams returned from API');
    } catch (err) {
      // Fallback to localStorage on API failure
      const cachedTeams = localStorageService.get(localStorageService.KEYS.TEAMS) || [];
      set({ teams: cachedTeams, isLoading: false });
      return {
        success: cachedTeams.length > 0,
        teams: cachedTeams,
        fromCache: true,
        error: err.response?.data?.error || err.message || 'Failed to fetch teams. Using cached data.'
      };
    }
  },

  // Helper to reconcile IDs after sync
  reconcileIds: (teams, idMap) => {
    return teams.map(team => {
      // If this team has a temp ID that now has a real ID mapping
      const realId = idMap[team._id];
      if (realId) {
        return { ...team, _id: realId };
      }
      return team;
    });
  },

  // Check if server data has items we don't have locally (or deleted items)
  syncWithServerData: (serverTeams) => {
    const currentTeams = get().teams;
    const serverTeamIds = new Set(serverTeams.map(t => t._id));
    const idMap = syncService.idMap;

    // Find teams that exist locally but not on server (unless they have temp IDs)
    const teamsToRemove = currentTeams.filter(team => {
      // Keep if it has a temp ID (not yet synced)
      const isTempId = team._id?.includes('-');
      if (isTempId) return false;

      // Remove if not in server list
      return !serverTeamIds.has(team._id) && !idMap[team._id];
    });

    // Reconcile IDs for temp teams that got real IDs
    const reconciledServerTeams = get().reconcileIds(serverTeams, idMap);

    // Merge: server data + local-only teams with temp IDs
    const tempIdTeams = currentTeams.filter(t => t._id?.includes('-') && !idMap[t._id]);

    // Merge server teams with reconciled IDs
    const merged = [...reconciledServerTeams];

    // Add temp teams that haven't been synced yet
    tempIdTeams.forEach(tempTeam => {
      if (!merged.find(t => t._id === tempTeam._id)) {
        merged.push(tempTeam);
      }
    });

    return merged;
  },

  refreshTeams: async () => {
    set({ isRefreshing: true });
    try {
      const { data } = await api.get('/api/team');
      const serverTeams = data?.teams || [];

      // Sync with server data - handles deletes from other users
      const syncedTeams = get().syncWithServerData(serverTeams);


      set({ teams: syncedTeams, isRefreshing: false });
      localStorageService.saveTeams(syncedTeams);
      localStorageService.updateLastSync();

      return { success: true, teams: syncedTeams, fromCache: false };
    } catch (err) {
      set({ isRefreshing: false });
      const cachedTeams = get().teams.length > 0
        ? get().teams
        : (localStorageService.get(localStorageService.KEYS.TEAMS) || []);

      if (get().teams.length === 0 && cachedTeams.length > 0) {
        set({ teams: cachedTeams });
      }
      return {
        success: cachedTeams.length > 0,
        teams: cachedTeams,
        fromCache: true,
        error: err.response?.data?.error || 'Failed to refresh. Using existing data.'
      };
    }
  },

  // Fetch a single team with fully populated members (name, email, avatar)
  fetchTeamDetails: async (teamId) => {
    try {
      const { data } = await api.get(`/api/team/${teamId}`);
      // Update both the list and currentTeam with the populated version
      set((state) => ({
        teams: state.teams.map((t) => (t._id === teamId ? data.team : t)),
        currentTeam: state.currentTeam?._id === teamId ? data.team : state.currentTeam,
      }));
      return { success: true, team: data.team };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to load team' };
    }
  },

  createTeam: async (name, description) => {
    if (!navigator.onLine) {
      toast.error('You are offline. Cannot create team.');
      return { success: false, error: 'Offline' };
    }

    const tempId = uuidv4();
    const p = { name, description };

    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/team', p);

      set((state) => {
        const updatedTeams = [...state.teams, data.team];
        localStorageService.saveTeams(updatedTeams);
        return { teams: updatedTeams, isLoading: false };
      });

      return { success: true, team: data.team };
    } catch (err) {
      set({ isLoading: false });
      return { success: false, error: err.response?.data?.error || 'Failed' };
    }
  },

  setCurrentTeam: (team) => {
    set({ currentTeam: team });
    localStorageService.saveCurrentTeam(team);
  },

  updateTeamName: async (id, name) => {
    if (!navigator.onLine) {
      toast.error('You are offline. Cannot update team.');
      return { success: false, error: 'Offline' };
    }

    try {
      const { data } = await api.put(`/api/team/${id}`, { name });

      set((state) => {
        const updatedTeams = state.teams.map((t) => (t._id === id ? data.team : t));
        const updatedCurrent = state.currentTeam?._id === id ? data.team : state.currentTeam;
        localStorageService.saveTeams(updatedTeams);
        localStorageService.saveCurrentTeam(updatedCurrent);
        return {
          teams: updatedTeams,
          currentTeam: updatedCurrent,
        };
      });
      return { success: true, team: data.team };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to update team' };
    }
  },

  deleteTeam: async (id) => {
    if (!navigator.onLine) {
      toast.error('You are offline. Cannot delete team.');
      return { success: false, error: 'Offline' };
    }

    const isNotFound = (err) => err.response?.status === 404 || err.response?.data?.error?.includes('not found');

    try {
      await api.delete(`/api/team/${id}`);
    } catch (err) {
      // If not found on server, still clean up locally
      if (!isNotFound(err)) {
        return { success: false, error: err.response?.data?.error || 'Failed to delete team' };
      }
      // Continue to local cleanup for 404 errors
    }

    // Clean up local state regardless of server response (for 404 or success)
    set((state) => {
      const updatedTeams = state.teams.filter((t) => t._id !== id);
      const updatedCurrent = state.currentTeam?._id === id ? null : state.currentTeam;
      localStorageService.saveTeams(updatedTeams);
      localStorageService.saveCurrentTeam(updatedCurrent);
      return {
        teams: updatedTeams,
        currentTeam: updatedCurrent,
      };
    });
    return { success: true };
  },

  // Register store for global refresh
  refresh: () => {
    get().refreshTeams();
  },

  inviteMember: async (teamId, email, role = 'developer') => {
    if (!navigator.onLine) {
      toast.error('You are offline. Cannot invite member.');
      return { success: false, error: 'Offline' };
    }
    try {
      const { data } = await api.post(`/api/team/${teamId}/invite`, { email, role });
      // Re-fetch populated team so member list updates
      await get().fetchTeamDetails(teamId);
      return { success: true, team: data.team };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Invite failed' };
    }
  },

  removeMember: async (teamId, userId) => {
    if (!navigator.onLine) {
      toast.error('You are offline. Cannot remove member.');
      return { success: false, error: 'Offline' };
    }
    try {
      const { data } = await api.delete(`/api/team/${teamId}/members/${userId}`);
      set((state) => ({
        teams: state.teams.map((t) => (t._id === teamId ? data.team : t)),
        currentTeam: state.currentTeam?._id === teamId ? data.team : state.currentTeam,
      }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Remove failed' };
    }
  },

  reset: () => {
    set({
      teams: [],
      currentTeam: null,
      isLoading: false,
      isRefreshing: false,
      pendingChanges: []
    });
  }
}));
