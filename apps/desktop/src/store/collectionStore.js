import { create } from 'zustand';
import api from '@/lib/api';
import { localStorageService } from '@/services/localStorageService';
import { syncService } from '@/services/syncService';
import { useConnectivityStore } from '@/store/connectivityStore';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { buildIndexMap } from '@/utils/perf';

export const useCollectionStore = create((set, get) => ({
  collections: localStorageService.get(localStorageService.KEYS.COLLECTIONS) || [],
  currentCollection: localStorageService.get(localStorageService.KEYS.CURRENT_COLLECTION) || null,
  requests: [],
  // O(1) request lookup Map — mirrors the requests array
  _requestsById: new Map(),
  isLoading: false,
  isLoadingRequests: false,
  loadingCollections: {}, // Track loading state per collectionId
  isRefreshing: false,
  isCreating: false,
  isDeleting: false,

  initFromStorage: () => {
    const stored = localStorageService.get(localStorageService.KEYS.COLLECTIONS);
    const current = localStorageService.get(localStorageService.KEYS.CURRENT_COLLECTION);
    if (stored) set({ collections: stored });
    if (current) set({ currentCollection: current });
  },

  fetchCollections: async (projectId, forceRefresh = false) => {
    if (!projectId) return;

    // Filter local collections for this specific project
    const localFiltered = get().collections.filter(c => String(c.projectId) === String(projectId));

    // If not forcing refresh and we have local data, return it
    if (!forceRefresh && localFiltered.length > 0) {
      return { success: true, collections: localFiltered, fromCache: true };
    }

    set({ isLoading: true });
    try {
      const { data } = await api.get('/api/collection', { params: { projectId } });
      const serverCollections = data.collections || [];

      set((state) => {
        // Merge server collections for this project with collections from other projects
        const others = state.collections.filter(c => String(c.projectId) !== String(projectId));
        const updated = [...others, ...serverCollections];
        localStorageService.saveCollections(updated);
        return { collections: updated, isLoading: false };
      });

      localStorageService.updateLastSync();
      return { success: true, collections: serverCollections, fromCache: false };
    } catch (err) {
      // Fallback to localStorage on API failure
      const cachedCollections = localStorageService.get(localStorageService.KEYS.COLLECTIONS) || [];
      set({ collections: cachedCollections, isLoading: false });
      return {
        success: cachedCollections.length > 0,
        collections: cachedCollections,
        fromCache: true,
        error: err.response?.data?.error || err.message || 'Failed to fetch collections. Using cached data.'
      };
    }
  },

  refreshCollections: async (projectId) => {
    if (!projectId) return;
    set({ isRefreshing: true });
    try {
      const { data } = await api.get('/api/collection', { params: { projectId } });
      const serverCollections = data.collections || [];

      const syncedCollections = get().syncWithServerData(serverCollections);

      set({ collections: syncedCollections, isRefreshing: false });
      localStorageService.saveCollections(syncedCollections);
      localStorageService.updateLastSync();

      // Update current collection if it was deleted
      const currentCollection = get().currentCollection;
      if (currentCollection && !syncedCollections.find(c => c._id === currentCollection._id)) {
        set({ currentCollection: syncedCollections[0] || null });
        localStorageService.saveCurrentCollection(syncedCollections[0] || null);
      }

      return { success: true, collections: syncedCollections, fromCache: false };
    } catch (err) {
      set({ isRefreshing: false });
      const cachedCollections = get().collections.length > 0
        ? get().collections
        : (localStorageService.get(localStorageService.KEYS.COLLECTIONS) || []);

      console.log('refreshCollections - Using cached collections:', cachedCollections.length);

      if (get().collections.length === 0 && cachedCollections.length > 0) {
        set({ collections: cachedCollections });
      }
      return {
        success: cachedCollections.length > 0,
        collections: cachedCollections,
        fromCache: true,
        error: err.response?.data?.error || 'Failed to refresh. Using existing data.'
      };
    }
  },

  // Helper to reconcile IDs after sync
  reconcileIds: (collections, idMap) => {
    return collections.map(collection => {
      const realId = idMap[collection._id];
      if (realId) {
        return { ...collection, _id: realId };
      }
      return collection;
    });
  },

  // Synchronizes EVERYTHING for the team: Collections and Requests
  syncAll: async (teamId) => {
    if (!teamId) return;
    set({ isRefreshing: true });
    try {
      // 1. Fetch Collections
      const { data: collData } = await api.get('/api/collection', { params: { teamId } });
      const serverCollections = collData.collections || [];

      // 2. Fetch Requests (Bulk)
      const { data: reqData } = await api.get('/api/request', { params: { teamId } });
      const serverRequests = reqData.requests || [];

      // 3. Reconcile Collections
      const syncedCollections = get().syncWithServerData(serverCollections);
      
      // 4. Reconcile Requests (via RequestStore)
      const { useRequestStore } = await import('@/store/requestStore');
      const updatedLocalRequestsMap = useRequestStore.getState().bulkSyncWithServerData(serverRequests);

      // 5. Update state
      set({ 
        collections: syncedCollections, 
        requests: serverRequests, // Flattened state for easy UI access
        isRefreshing: false 
      });

      // 6. Persistence
      localStorageService.saveCollections(syncedCollections);
      localStorageService.updateLastSync();

      return { success: true, collections: syncedCollections, requests: serverRequests };
    } catch (err) {
      set({ isRefreshing: false });
      return { success: false, error: err.message };
    }
  },

  // Check if server data has items we don't have locally (or deleted items)
  syncWithServerData: (serverCollections) => {
    const currentCollections = get().collections;
    const serverCollectionIds = new Set(serverCollections.map(c => c._id));
    const idMap = syncService.idMap;

    // Reconciliation: If it's on server, it wins. 
    // If it's only in local and has no temp ID, it's stale (deleted elsewhere).
    const reconciledServerCollections = get().reconcileIds(serverCollections, idMap);
    
    // Keep local collections with temp IDs (not yet synced to server)
    const tempIdCollections = currentCollections.filter(c => c._id?.includes('-') && !idMap[c._id]);

    const merged = [...reconciledServerCollections];
    tempIdCollections.forEach(tempCollection => {
      if (!merged.find(c => c._id === tempCollection._id)) {
        merged.push(tempCollection);
      }
    });

    return merged;
  },

  // Register store for global refresh
  refresh: () => {
    const { useTeamStore } = require('@/store/teamStore');
    const teamId = useTeamStore.getState().currentTeam?._id;
    if (teamId) {
      get().syncAll(teamId);
    }
  },

  fetchCollectionRequests: async (collectionId, forceRefresh = false) => {
    const { useRequestStore } = await import('@/store/requestStore');

    // If not forcing refresh, try to load from storage first
    if (!forceRefresh) {
      const cached = get().loadCollectionRequestsFromStorage(collectionId);
      if (cached.success) {
        return { ...cached, fromCache: true };
      }
    }

    set((state) => ({
      isLoadingRequests: true,
      loadingCollections: { ...state.loadingCollections, [collectionId]: true }
    }));
    try {
      const { data } = await api.get(`/api/collection/${collectionId}`);
      const serverRequests = data.requests || [];

      // Sync with server data to remove deleted items and reconcile IDs
      const requestStore = useRequestStore.getState();
      const syncedRequests = requestStore.syncWithServerData(serverRequests, collectionId);

      set((state) => {
        // Merge new requests with existing ones for other collections
        const existingRequests = state.requests.filter(r => r.collectionId !== collectionId);
        const newRequests = [...existingRequests, ...syncedRequests];
        const newLoadingCollections = { ...state.loadingCollections, [collectionId]: false };
        return {
          currentCollection: data.collection,
          requests: newRequests,
          isLoadingRequests: Object.values(newLoadingCollections).some(v => v),
          loadingCollections: newLoadingCollections
        };
      });
      localStorageService.saveCurrentCollection(data.collection);
      return { ...data, requests: syncedRequests, fromCache: false };
    } catch (err) {
      // Fallback to localStorage on API failure
      const cachedCollection = localStorageService.get(localStorageService.KEYS.CURRENT_COLLECTION);
      const cachedRequests = localStorageService.getRequests(collectionId);

      if (cachedCollection?._id === collectionId || !get().currentCollection) {
        set({ currentCollection: cachedCollection });
      }
      // Add cached requests to the store
      set((state) => {
        const existingRequests = state.requests.filter(r => r.collectionId !== collectionId);
        const newLoadingCollections = { ...state.loadingCollections, [collectionId]: false };
        return {
          requests: [...existingRequests, ...cachedRequests],
          isLoadingRequests: Object.values(newLoadingCollections).some(v => v),
          loadingCollections: newLoadingCollections
        };
      });
      return {
        collection: cachedCollection,
        requests: cachedRequests,
        fromCache: true,
        error: 'Failed to fetch. Using cached data.'
      };
    }
  },

  refreshCollectionRequests: async (collectionId) => {
    const { useRequestStore } = await import('@/store/requestStore');
    try {
      const { data } = await api.get(`/api/collection/${collectionId}`);
      const serverRequests = data.requests || [];

      const requestStore = useRequestStore.getState();
      const syncedRequests = requestStore.syncWithServerData(serverRequests, collectionId);

      // Merge: keep existing requests from other collections, update this collection's requests
      set((state) => {
        const existingRequests = state.requests.filter(r => r.collectionId !== collectionId);
        const mergedRequests = [...existingRequests, ...syncedRequests];
        return { currentCollection: data.collection, requests: mergedRequests };
      });

      localStorageService.saveCurrentCollection(data.collection);
      // syncedRequests are already saved in syncWithServerData
      localStorageService.updateLastSync();

      // Update currently active request if it was modified
      const currentReq = requestStore.currentRequest;
      if (currentReq && currentReq.collectionId === collectionId) {
        const updatedCurrentReq = syncedRequests.find(r => r._id === currentReq._id);
        if (updatedCurrentReq) {
          requestStore.setCurrentRequest(updatedCurrentReq);
        }
      }

      return { success: true, collection: data.collection, requests: syncedRequests, fromCache: false };
    } catch (err) {
      // Keep existing cached data on refresh failure - don't wipe
      const cachedCollection = localStorageService.get(localStorageService.KEYS.CURRENT_COLLECTION);
      const cachedRequests = localStorageService.getRequests(collectionId);
      return {
        success: true,
        collection: cachedCollection,
        requests: cachedRequests,
        fromCache: true,
        error: err.response?.data?.error || 'Failed to refresh. Using existing data.'
      };
    }
  },

  // Load from localStorage only - no API call
  loadCollectionRequestsFromStorage: (collectionId) => {
    const cachedCollection = localStorageService.get(localStorageService.KEYS.CURRENT_COLLECTION);
    const cachedRequests = localStorageService.getRequests(collectionId);

    // Only update if we have cached data for this collection
    if (cachedRequests.length > 0 || cachedCollection?._id === collectionId) {
      set((state) => {
        // Merge with existing requests from other collections
        const existingRequests = state.requests.filter(r => r.collectionId !== collectionId);
        return {
          currentCollection: cachedCollection?._id === collectionId ? cachedCollection : state.currentCollection,
          requests: [...existingRequests, ...cachedRequests]
        };
      });
      return { success: true, collection: cachedCollection, requests: cachedRequests, fromCache: true };
    }
    return { success: false, requests: [], fromCache: true };
  },

  createCollection: async (name, projectId, teamId, description) => {
    set({ isCreating: true });

    const handleOfflineCreate = () => {
      const tempId = `temp_${uuidv4()}`;
      const mockCollection = { _id: tempId, name, projectId, teamId, description };
      syncService.queueChange('create_collection', mockCollection, tempId);
      
      set((state) => {
        const updated = [mockCollection, ...state.collections];
        localStorageService.saveCollections(updated);
        return { collections: updated, isCreating: false };
      });
      
      toast.success('Collection created locally (Sync pending)');
      return { success: true, collection: mockCollection, offline: true };
    };

    try {
      const { data } = await api.post('/api/collection', { name, projectId, teamId, description });

      set((state) => {
        const updated = [data.collection, ...state.collections];
        localStorageService.saveCollections(updated);
        return { collections: updated, isCreating: false };
      });

      if (data.collection?._id) {
        const { useSocketStore } = await import('@/store/socketStore');
        const { useAuthStore } = await import('@/store/authStore');
        const { useTeamStore } = await import('@/store/teamStore');
        useSocketStore.getState().emitCollectionCreated(
          useTeamStore.getState().currentTeam?._id,
          data.collection,
          useAuthStore.getState().user?._id
        );
      }

      return { success: true, collection: data.collection };
    } catch (err) {
      const isNetError = !err.response && (err.code === 'ERR_NETWORK' || !navigator.onLine);
      if (isNetError) {
        return handleOfflineCreate();
      }
      set({ isCreating: false });
      return { success: false, error: err.response?.data?.error || 'Failed to create collection' };
    }
  },

  updateCollection: (collection) => {
    set((state) => {
      const updated = state.collections.map((c) => (c._id === collection._id ? collection : c));
      const updatedCurrent = state.currentCollection?._id === collection._id ? collection : state.currentCollection;
      localStorageService.saveCollections(updated);
      localStorageService.saveCurrentCollection(updatedCurrent);
      return {
        collections: updated,
        currentCollection: updatedCurrent,
      };
    });
  },

  updateCollectionName: async (id, name) => {
    const handleOfflineUpdate = () => {
      syncService.queueChange('update_collection', { id, name });
      
      set((state) => {
        const updated = state.collections.map((c) => (c._id === id ? { ...c, name } : c));
        const updatedCurrent = state.currentCollection?._id === id ? { ...state.currentCollection, name } : state.currentCollection;
        localStorageService.saveCollections(updated);
        localStorageService.saveCurrentCollection(updatedCurrent);
        return {
          collections: updated,
          currentCollection: updatedCurrent,
        };
      });
      
      toast.success('Collection renamed locally (Sync pending)');
      return { success: true, offline: true };
    };

    try {
      const { data } = await api.put(`/api/collection/${id}`, { name });

      set((state) => {
        const updated = state.collections.map((c) => (c._id === id ? data.collection : c));
        const updatedCurrent = state.currentCollection?._id === id ? data.collection : state.currentCollection;
        localStorageService.saveCollections(updated);
        localStorageService.saveCurrentCollection(updatedCurrent);
        return {
          collections: updated,
          currentCollection: updatedCurrent,
        };
      });

      const { useSocketStore } = await import('@/store/socketStore');
      const { useAuthStore } = await import('@/store/authStore');
      const { useTeamStore } = await import('@/store/teamStore');
      useSocketStore.getState().emitCollectionUpdate(
        useTeamStore.getState().currentTeam?._id,
        data.collection,
        useAuthStore.getState().user?._id
      );

      return { success: true, collection: data.collection };
    } catch (err) {
      const isNetError = !err.response && (err.code === 'ERR_NETWORK' || !navigator.onLine);
      if (isNetError) {
        return handleOfflineUpdate();
      }
      return { success: false, error: err.response?.data?.error || 'Failed to update collection' };
    }
  },

  addRequest: (data) => {
    set((state) => {
      const request = data.request || data;
      // O(1) duplicate check via Map instead of O(n) find
      if (state._requestsById.has(request._id)) return state;

      const updated = [...state.requests, request];
      const newMap = new Map(state._requestsById);
      newMap.set(request._id, request);

      const collectionRequests = updated.filter(r => r.collectionId === request.collectionId);
      localStorageService.saveRequests(request.collectionId, collectionRequests);
      return { requests: updated, _requestsById: newMap };
    });
  },

  updateRequest: (request) => {
    set((state) => {
      // O(1) update: only rebuild the affected item
      if (!state._requestsById.has(request._id)) {
        // Not tracked yet — fall back to full replace
        const updated = [...state.requests, request];
        const newMap = new Map(state._requestsById);
        newMap.set(request._id, request);
        const collectionRequests = updated.filter(r => r.collectionId === request.collectionId);
        localStorageService.saveRequests(request.collectionId, collectionRequests);
        return { requests: updated, _requestsById: newMap };
      }

      const updated = state.requests.map((r) => (r._id === request._id ? request : r));
      const newMap = new Map(state._requestsById);
      newMap.set(request._id, request);
      const collectionRequests = updated.filter(r => r.collectionId === request.collectionId);
      localStorageService.saveRequests(request.collectionId, collectionRequests);
      return { requests: updated, _requestsById: newMap };
    });
  },

  removeRequest: (requestId, collectionId) => {
    set((state) => {
      // O(1) delete from Map
      const newMap = new Map(state._requestsById);
      newMap.delete(requestId);

      const updated = state.requests.filter((r) => r._id !== requestId);
      if (collectionId) {
        const remainingForColl = updated.filter(r => r.collectionId === collectionId);
        localStorageService.saveRequests(collectionId, remainingForColl);
      }
      return { requests: updated, _requestsById: newMap };
    });
  },

  setCurrentCollection: (collection) => {
    set({ currentCollection: collection });
    localStorageService.saveCurrentCollection(collection);
    if (collection) {
      // Use existing merging logic to load from storage if not already in memory
      get().loadCollectionRequestsFromStorage(collection._id);
    }
  },

  // Get collections filtered by project ID
  getFilteredCollections: (projectId) => {
    if (!projectId) return [];
    return get().collections.filter(c => String(c.projectId) === String(projectId));
  },

  deleteCollection: async (id) => {
    const isNotFound = (err) => err.response?.status === 404 || err.response?.data?.error?.includes('not found');
    set({ isDeleting: true });

    const localCleanup = () => {
      set((state) => {
        const updated = state.collections.filter((c) => c._id !== id);
        const updatedCurrent = state.currentCollection?._id === id ? null : state.currentCollection;
        localStorageService.saveCollections(updated);
        localStorageService.saveCurrentCollection(updatedCurrent);
        // Also clean up requests for this collection
        localStorageService.saveRequests(id, []);
        return {
          collections: updated,
          currentCollection: updatedCurrent,
          isDeleting: false
        };
      });
    };

    const handleOfflineDelete = () => {
      syncService.queueChange('delete_collection', { id });
      localCleanup();
      toast.success('Collection deleted locally (Sync pending)');
      return { success: true, offline: true };
    };

    try {
      await api.delete(`/api/collection/${id}`);

      const { useSocketStore } = await import('@/store/socketStore');
      const { useAuthStore } = await import('@/store/authStore');
      const { useTeamStore } = await import('@/store/teamStore');
      useSocketStore.getState().emitCollectionDeleted(
        useTeamStore.getState().currentTeam?._id,
        id,
        useAuthStore.getState().user?._id
      );
      localCleanup();
    } catch (err) {
      const isNetError = !err.response && (err.code === 'ERR_NETWORK' || !navigator.onLine);
      if (isNetError) {
        return handleOfflineDelete();
      }

      // If not found on server, still clean up locally
      if (!isNotFound(err)) {
        set({ isDeleting: false });
        return { success: false, error: err.response?.data?.error || 'Failed to delete collection' };
      }
      localCleanup();
    }

    return { success: true };
  },

  reset: () => {
    set({
      collections: [],
      currentCollection: null,
      requests: [],
      isLoading: false,
      isLoadingRequests: false,
      loadingCollections: {},
      isRefreshing: false,
      isCreating: false,
      isDeleting: false
    });
  }
}));
