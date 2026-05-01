import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';
import { localStorageService } from '@/services/localStorageService';
import { syncService } from '@/services/syncService';
import { v4 as uuidv4 } from 'uuid';
import { useConnectivityStore } from '@/store/connectivityStore';
import toast from 'react-hot-toast';
import { deepClone } from '@/utils/perf';
import { rustUrlParseParams, rustUrlBuild, jsBuildUrl, jsParseParams } from '@/lib/rust';
import { useCollectionStore } from '@/store/collectionStore';
import { useProjectStore } from '@/store/projectStore';
import { useTeamStore } from '@/store/teamStore';

const defaultRequest = () => ({
  _id: null,
  name: 'Untitled Request',
  method: 'GET',
  protocol: 'http', // 'http' | 'ws' | 'socketio'
  url: '',
  headers: [{ id: uuidv4(), key: '', value: '', enabled: true }],
  params: [{ id: uuidv4(), key: '', value: '', enabled: true }],
  body: { mode: 'none', raw: '', rawLanguage: 'json', formData: [], urlencoded: [] },
  auth: { type: 'none', bearer: { token: '' }, basic: { username: '', password: '' }, apikey: { key: '', value: '', in: 'header' } },
  collectionId: null,
  projectId: null,
  teamId: null,
});

// syncParamsFromUrl and syncUrlFromParams are now delegated to Rust
// via rustUrlParseParams / rustUrlBuild in @/lib/rust.js.
// JS fallback implementations live inside rust.js for non-Tauri environments.

export const useRequestStore = create(
  persist(
    (set, get) => ({
      currentRequest: defaultRequest(),
      response: null,
      isExecuting: false,
      isSaving: false,
      isCreating: false,
      isDeleting: false,
      cancelCurrentRequest: null,
      history: [],
      activeTab: 'params',
      noActiveRequest: false,
      openTabs: [],
      activeTabId: null,
      // O(1) tab lookup map — kept in sync with openTabs
      _tabsById: new Map(),

      setCurrentRequest: (req) => {
        const ensureIds = (arr = []) =>
          arr.map((item) => ({
            ...item,
            id: item.id || (item._id ? String(item._id) : uuidv4()),
          }));

        if (!req) {
          set({ currentRequest: defaultRequest(), response: null });
          return;
        }

        const newReq = {
          ...defaultRequest(),
          ...req,
          params: ensureIds(req.params),
          headers: ensureIds(req.headers),
          url: jsBuildUrl(req.url || '', req.params || [])
        };

        set((state) => {
          const tabId = newReq._id;
          // O(1) lookup via Map
          if (tabId && state._tabsById.has(tabId)) {
            localStorageService.saveCurrentRequest(newReq);
            return { currentRequest: newReq, noActiveRequest: false, activeTabId: tabId };
          }

          const newTabId = tabId || uuidv4();
          const newTab = {
            id: newTabId,
            request: newReq,
            originalRequest: deepClone(newReq),
            isDirty: false,
            activeTab: 'params', // Per-tab sub-tab state
          };
          const newTabsById = new Map(state._tabsById);
          newTabsById.set(newTabId, newTab);
          localStorageService.saveCurrentRequest(newReq);
          return {
            currentRequest: newReq,
            noActiveRequest: false,
            openTabs: [...state.openTabs, newTab],
            activeTabId: newTabId,
            activeTab: 'params',
            _tabsById: newTabsById,
          };
        });
      },

      setNoActiveRequest: (value) => set({ noActiveRequest: value }),

      setActiveTabId: (id) => {
        set((state) => {
          const tab = state._tabsById.get(id);
          if (!tab) return state;
          localStorageService.saveCurrentRequest(tab.request);
          return {
            activeTabId: id,
            currentRequest: tab.request,
            activeTab: tab.activeTab || 'params',
            noActiveRequest: false
          };
        });
      },

      closeTab: (id) => {
        set((state) => {
          const newTabs = state.openTabs.filter(t => t.id !== id);
          const newTabsById = new Map(state._tabsById);
          newTabsById.delete(id);
          const isClosingActive = state.activeTabId === id;

          if (newTabs.length === 0) {
            return { openTabs: [], activeTabId: null, currentRequest: defaultRequest(), noActiveRequest: true, _tabsById: newTabsById };
          }

          if (isClosingActive) {
            const closingIndex = state.openTabs.findIndex(t => t.id === id);
            const nextTab = newTabs[closingIndex - 1] || newTabs[0];
            localStorageService.saveCurrentRequest(nextTab.request);
            return { openTabs: newTabs, activeTabId: nextTab.id, currentRequest: nextTab.request, noActiveRequest: false, _tabsById: newTabsById };
          }

          return { openTabs: newTabs, _tabsById: newTabsById };
        });
      },

      closeAllTabs: () => {
        set({
          openTabs: [],
          activeTabId: null,
          currentRequest: defaultRequest(),
          noActiveRequest: true,
          _tabsById: new Map()
        });
      },

      closeOtherTabs: (id) => {
        set((state) => {
          const tabToKeep = state._tabsById.get(id);
          if (!tabToKeep) return state;

          const newTabsById = new Map();
          newTabsById.set(id, tabToKeep);

          localStorageService.saveCurrentRequest(tabToKeep.request);
          return {
            openTabs: [tabToKeep],
            activeTabId: tabToKeep.id,
            currentRequest: tabToKeep.request,
            activeTab: tabToKeep.activeTab || 'params',
            noActiveRequest: false,
            _tabsById: newTabsById
          };
        });
      },

      closeTabsToRight: (id) => {
        set((state) => {
          const index = state.openTabs.findIndex(t => t.id === id);
          if (index === -1) return state;

          const newTabs = state.openTabs.slice(0, index + 1);
          const newTabsById = new Map();
          newTabs.forEach(t => newTabsById.set(t.id, t));

          // If active tab was closed, switch to the target tab
          const activeIndex = state.openTabs.findIndex(t => t.id === state.activeTabId);
          if (activeIndex > index) {
            const nextTab = newTabs[newTabs.length - 1];
            localStorageService.saveCurrentRequest(nextTab.request);
            return {
              openTabs: newTabs,
              activeTabId: nextTab.id,
              currentRequest: nextTab.request,
              activeTab: nextTab.activeTab || 'params',
              _tabsById: newTabsById
            };
          }

          return { openTabs: newTabs, _tabsById: newTabsById };
        });
      },

      closeTabsToLeft: (id) => {
        set((state) => {
          const index = state.openTabs.findIndex(t => t.id === id);
          if (index <= 0) return state;

          const newTabs = state.openTabs.slice(index);
          const newTabsById = new Map();
          newTabs.forEach(t => newTabsById.set(t.id, t));

          // If active tab was closed, switch to the target tab
          const activeIndex = state.openTabs.findIndex(t => t.id === state.activeTabId);
          if (activeIndex < index) {
            const nextTab = newTabs[0];
            localStorageService.saveCurrentRequest(nextTab.request);
            return {
              openTabs: newTabs,
              activeTabId: nextTab.id,
              currentRequest: nextTab.request,
              activeTab: nextTab.activeTab || 'params',
              _tabsById: newTabsById
            };
          }

          return { openTabs: newTabs, _tabsById: newTabsById };
        });
      },

      updateField: (field, value) => {
        set((state) => {
          const req = { ...state.currentRequest, [field]: value };

          // Sync URL ↔ Params via Rust (async, non-blocking UI)
          if (field === 'url') {
            rustUrlParseParams(value, req.params).then(params => {
              set((s) => {
                const r = { ...s.currentRequest, params };
                const openTabs = [...s.openTabs];
                const tIdx = openTabs.findIndex(t => t.id === s.activeTabId);
                const newTabsById = new Map(s._tabsById);
                if (tIdx >= 0) {
                  const updatedTab = { ...openTabs[tIdx], request: r, isDirty: true };
                  openTabs[tIdx] = updatedTab;
                  newTabsById.set(s.activeTabId, updatedTab);
                }
                return { currentRequest: r, openTabs, _tabsById: newTabsById };
              });
            });
          } else if (field === 'params') {
            rustUrlBuild(req.url, value).then(url => {
              set((s) => {
                const r = { ...s.currentRequest, url };
                const openTabs = [...s.openTabs];
                const tIdx = openTabs.findIndex(t => t.id === s.activeTabId);
                const newTabsById = new Map(s._tabsById);
                if (tIdx >= 0) {
                  const updatedTab = { ...openTabs[tIdx], request: r, isDirty: true };
                  openTabs[tIdx] = updatedTab;
                  newTabsById.set(s.activeTabId, updatedTab);
                }
                return { currentRequest: r, openTabs, _tabsById: newTabsById };
              });
            });
          }

          const openTabs = [...state.openTabs];
          const tIdx = openTabs.findIndex(t => t.id === state.activeTabId);
          const newTabsById = new Map(state._tabsById);
          if (tIdx >= 0) {
            const updatedTab = { ...openTabs[tIdx], request: req, isDirty: true };
            openTabs[tIdx] = updatedTab;
            newTabsById.set(state.activeTabId, updatedTab);
          }

          if (req._id) {
            import('@/store/collectionStore').then(({ useCollectionStore }) => {
              useCollectionStore.getState().updateRequest(req);
            });
          }

          return { currentRequest: req, openTabs, _tabsById: newTabsById };
        });
      },

      updateBody: (bodyUpdate) =>
        set((state) => {
          const req = {
            ...state.currentRequest,
            body: { ...state.currentRequest.body, ...bodyUpdate },
          };
          const openTabs = [...state.openTabs];
          const tIdx = openTabs.findIndex(t => t.id === state.activeTabId);
          const newTabsById = new Map(state._tabsById);
          if (tIdx >= 0) {
            const updatedTab = { ...openTabs[tIdx], request: req, isDirty: true };
            openTabs[tIdx] = updatedTab;
            newTabsById.set(state.activeTabId, updatedTab);
          }
          if (req._id) {
            import('@/store/collectionStore').then(({ useCollectionStore }) => {
              useCollectionStore.getState().updateRequest(req);
            });
          }
          return { currentRequest: req, openTabs, _tabsById: newTabsById };
        }),

      updateAuth: (authUpdate) =>
        set((state) => {
          const req = {
            ...state.currentRequest,
            auth: { ...state.currentRequest.auth, ...authUpdate },
          };
          const openTabs = [...state.openTabs];
          const tIdx = openTabs.findIndex(t => t.id === state.activeTabId);
          const newTabsById = new Map(state._tabsById);
          if (tIdx >= 0) {
            const updatedTab = { ...openTabs[tIdx], request: req, isDirty: true };
            openTabs[tIdx] = updatedTab;
            newTabsById.set(state.activeTabId, updatedTab);
          }
          if (req._id) {
            import('@/store/collectionStore').then(({ useCollectionStore }) => {
              useCollectionStore.getState().updateRequest(req);
            });
          }
          return { currentRequest: req, openTabs, _tabsById: newTabsById };
        }),

      setActiveTab: (tab) =>
        set((state) => {
          const openTabs = [...state.openTabs];
          const tIdx = openTabs.findIndex(t => t.id === state.activeTabId);
          const newTabsById = new Map(state._tabsById);
          if (tIdx >= 0) {
            const updatedTab = { ...openTabs[tIdx], activeTab: tab };
            openTabs[tIdx] = updatedTab;
            newTabsById.set(state.activeTabId, updatedTab);
          }
          return { activeTab: tab, openTabs, _tabsById: newTabsById };
        }),

      setResponse: (response) => set({ response }),

      setIsExecuting: (isExecuting) => set({ isExecuting }),

      addToHistory: (entry) =>
        set((state) => {
          // Emergency cache clearer: Strip out huge bodies from old history entries
          const cleanedHistory = state.history.map(item => ({
            ...item,
            response: item.response ? { ...item.response, body: '[Body hidden in history]' } : undefined
          }));
          return {
            history: [entry, ...cleanedHistory].slice(0, 50),
          };
        }),

      newRequest: async () => {
        const colStore = useCollectionStore.getState();
        const projStore = useProjectStore.getState();
        const teamStore = useTeamStore.getState();

        let targetColId = colStore.currentCollection?._id;
        let targetProjId = projStore.currentProject?._id;
        let targetTeamId = teamStore.currentTeam?._id;

        console.log('New Request Logic:', { targetColId, targetProjId, targetTeamId });

        // 1. If no collection selected, use the first available one in the current project
        if (!targetColId && targetProjId) {
          const projectCols = (colStore.collections || []).filter(c => String(c.projectId) === String(targetProjId));
          if (projectCols.length > 0) {
            const firstCol = projectCols[0];
            targetColId = firstCol._id;
            colStore.setCurrentCollection(firstCol);
          }
        }

        // 2. If still no collection but we have a project, create a default collection
        if (!targetColId && targetProjId && targetTeamId) {
          const tid = toast.loading('Creating collection...');
          try {
            const res = await colStore.createCollection({
              name: 'My Collection',
              projectId: targetProjId,
              teamId: targetTeamId
            });
            if (res.success) {
              targetColId = res.collection._id;
              toast.success('Collection created', { id: tid });
            } else {
              toast.error(res.error || 'Failed to create collection', { id: tid });
            }
          } catch (err) {
            toast.error('Error creating collection', { id: tid });
            console.error(err);
          }
        }

        const newReq = {
          ...defaultRequest(),
          collectionId: targetColId || null,
          projectId: targetProjId || null,
          teamId: targetTeamId || null,
          folderId: colStore.currentFolderId || null
        };

        get().setCurrentRequest(newReq);
      },

      saveRequest: async () => {
        const req = get().currentRequest;
        set({ isSaving: true });

        const handleOfflineSave = () => {
          syncService.queueChange('update_request', { id: req._id, ...req });
          set({ isSaving: false });
          toast.success('Saved locally (Sync pending)');
          return { success: true, offline: true };
        };

        try {
          if (req._id) {
            const { data } = await api.put(`/api/request/${req._id}`, req);

            set(state => {
              const newTabs = [...state.openTabs];
              const idx = newTabs.findIndex(t => t.id === state.activeTabId);
              if (idx >= 0) newTabs[idx] = { ...newTabs[idx], request: data.request, originalRequest: deepClone(data.request), isDirty: false };
              return { currentRequest: data.request, openTabs: newTabs, isSaving: false };
            });

            localStorageService.saveCurrentRequest(data.request);
            const { useSocketStore } = await import('@/store/socketStore');
            const { useAuthStore } = await import('@/store/authStore');
            const { useTeamStore } = await import('@/store/teamStore');
            useSocketStore.getState().emitRequestUpdate(
              useTeamStore.getState().currentTeam?._id,
              data.request,
              useAuthStore.getState().user?._id
            );
            return { success: true };
          } else if (req.collectionId) {
            const { data } = await api.post('/api/request', req);

            set(state => {
              const newTabs = [...state.openTabs];
              const idx = newTabs.findIndex(t => t.id === state.activeTabId);
              if (idx >= 0) newTabs[idx] = { id: data.request._id, request: data.request, originalRequest: deepClone(data.request), isDirty: false };
              return { currentRequest: data.request, openTabs: newTabs, activeTabId: data.request._id, isSaving: false };
            });

            localStorageService.saveCurrentRequest(data.request);
            const { useSocketStore } = await import('@/store/socketStore');
            const { useAuthStore } = await import('@/store/authStore');
            const { useTeamStore } = await import('@/store/teamStore');
            const { useCollectionStore } = await import('@/store/collectionStore');

            useCollectionStore.getState().addRequest(data.request);

            useSocketStore.getState().emitRequestCreated(
              useTeamStore.getState().currentTeam?._id,
              data.request,
              useAuthStore.getState().user?._id
            );
            return { success: true, request: data.request };
          }
        } catch (err) {
          const isNetError = !err.response && (err.code === 'ERR_NETWORK' || !navigator.onLine);
          if (isNetError && req._id) {
            return handleOfflineSave();
          }
          set({ isSaving: false });
          return { success: false, error: err.response?.data?.error || 'Save failed' };
        }
      },
      createRequest: async (requestData) => {
        const { collectionId } = requestData;
        const { useCollectionStore } = await import('@/store/collectionStore');
        const collectionStore = useCollectionStore.getState();
        set({ isCreating: true });

        const handleOfflineCreate = () => {
          const tempId = `temp_${uuidv4()}`;
          const mockRequest = { ...requestData, _id: tempId };
          syncService.queueChange('create_request', mockRequest, tempId);
          collectionStore.addRequest(mockRequest);
          set({ isCreating: false });
          toast.success('Created locally (Sync pending)');
          return { success: true, request: mockRequest, offline: true };
        };

        try {
          const { data } = await api.post('/api/request', requestData);

          if (data.request?._id) {
            collectionStore.addRequest(data.request);
            const { useSocketStore } = await import('@/store/socketStore');
            const { useAuthStore } = await import('@/store/authStore');
            const { useTeamStore } = await import('@/store/teamStore');
            useSocketStore.getState().emitRequestCreated(
              useTeamStore.getState().currentTeam?._id,
              data.request,
              useAuthStore.getState().user?._id
            );
          }
          set({ isCreating: false });
          return { success: true, request: data.request };
        } catch (err) {
          const isNetError = !err.response && (err.code === 'ERR_NETWORK' || !navigator.onLine);
          if (isNetError) {
            return handleOfflineCreate();
          }
          set({ isCreating: false });
          return { success: false, error: err.response?.data?.error || 'Failed to create request' };
        }
      },

      updateRequestName: async (id, name) => {
        const currentReq = get().currentRequest;

        const handleOfflineUpdate = () => {
          syncService.queueChange('update_request', { id, name });
          if (currentReq?._id === id) {
            const updated = { ...currentReq, name };
            set({ currentRequest: updated });
            localStorageService.saveCurrentRequest(updated);
          }
          toast.success('Renamed locally (Sync pending)');
          return { success: true, offline: true };
        };

        try {
          const { data } = await api.put(`/api/request/${id}`, { name });
          if (currentReq?._id === id) {
            const updated = { ...currentReq, name: data.request.name };
            set({ currentRequest: updated });
            localStorageService.saveCurrentRequest(updated);
          }
          return { success: true, request: data.request };
        } catch (err) {
          const isNetError = !err.response && (err.code === 'ERR_NETWORK' || !navigator.onLine);
          if (isNetError) {
            return handleOfflineUpdate();
          }
          return { success: false, error: err.response?.data?.error || 'Failed to update request' };
        }
      },

      refreshRequest: async (id) => {
        if (!id) return { success: false, error: 'No request ID' };
        try {
          const { data } = await api.get(`/api/request/${id}`);
          const currentReq = get().currentRequest;
          if (currentReq?._id === id) {
            set({ currentRequest: data.request });
            localStorageService.saveCurrentRequest(data.request);
          }
          // Also save to collection requests cache
          if (data.request?.collectionId) {
            const existingRequests = localStorageService.getRequests(data.request.collectionId);
            const updatedRequests = existingRequests.map(r => r._id === id ? data.request : r);
            localStorageService.saveRequests(data.request.collectionId, updatedRequests);
          }
          localStorageService.updateLastSync();
          return { success: true, request: data.request, fromCache: false };
        } catch (err) {
          // Try to get from localStorage
          const cachedRequest = localStorageService.get(localStorageService.KEYS.CURRENT_REQUEST);
          if (cachedRequest?._id === id) {
            const currentReq = get().currentRequest;
            if (currentReq?._id === id) {
              set({ currentRequest: cachedRequest });
            }
            return {
              success: true,
              request: cachedRequest,
              fromCache: true,
              error: 'Failed to refresh. Using cached data.'
            };
          }
          return {
            success: false,
            fromCache: false,
            error: err.response?.data?.error || 'Failed to refresh request'
          };
        }
      },

      getCachedRequest: (id, collectionId) => {
        // 1. Fast-path: check current request (O(1))
        const currentReq = get().currentRequest;
        if (currentReq?._id === id) return currentReq;

        // 2. Check open tabs Map (O(1))
        const tabsById = get()._tabsById;
        if (tabsById.has(id)) return tabsById.get(id).request;

        // 3. Check collection requests (O(n) — unavoidable, but targeted)
        if (collectionId) {
          const collectionRequests = localStorageService.getRequests(collectionId);
          const found = collectionRequests.find(r => r._id === id);
          if (found) return found;
        }

        // 4. Full scan of localStorage (last resort)
        const allRequests = localStorageService.get(localStorageService.KEYS.REQUESTS) || {};
        for (const collId in allRequests) {
          const found = allRequests[collId].find(r => r._id === id);
          if (found) return found;
        }

        return null;
      },

      deleteRequest: async (id, collectionId) => {
        const isNotFound = (err) => err.response?.status === 404 || err.response?.data?.error?.includes('not found');
        set({ isDeleting: true });

        const localCleanup = async () => {
          if (collectionId) {
            const { useCollectionStore } = await import('@/store/collectionStore');
            useCollectionStore.getState().removeRequest(id, collectionId);
          }

          set((state) => {
            const isCurrent = state.currentRequest?._id === id;
            return {
              requests: state.requests ? state.requests.filter(r => r._id !== id) : [],
              currentRequest: isCurrent ? null : state.currentRequest,
              noActiveRequest: isCurrent ? true : state.noActiveRequest,
              isDeleting: false,
            };
          });
        };

        const handleOfflineDelete = async () => {
          syncService.queueChange('delete_request', { id, collectionId });
          await localCleanup();
          toast.success('Deleted locally (Sync pending)');
          return { success: true, offline: true };
        };

        try {
          await api.delete(`/api/request/${id}`);

          const { useSocketStore } = await import('@/store/socketStore');
          const { useAuthStore } = await import('@/store/authStore');
          const { useTeamStore } = await import('@/store/teamStore');
          useSocketStore.getState().emitRequestDeleted(
            useTeamStore.getState().currentTeam?._id,
            collectionId,
            id,
            useAuthStore.getState().user?._id
          );
          await localCleanup();
        } catch (err) {
          const isNetError = !err.response && (err.code === 'ERR_NETWORK' || !navigator.onLine);
          if (isNetError) {
            return handleOfflineDelete();
          }

          // If not found on server, still clean up locally
          if (!isNotFound(err)) {
            set({ isDeleting: false });
            return { success: false, error: err.response?.data?.error || 'Failed to delete request' };
          }
          await localCleanup();
        }

        return { success: true };
      },

      // Helper to reconcile IDs after sync
      reconcileIds: (requests, idMap) => {
        return requests.map(request => {
          const realId = idMap[request._id];
          if (realId) {
            return { ...request, _id: realId };
          }
          return request;
        });
      },

      // Check if server data has items we don't have locally (or deleted items)
      syncWithServerData: (serverRequests, collectionId) => {
        const currentRequests = localStorageService.getRequests(collectionId);
        const serverRequestIds = new Set(serverRequests.map(r => r._id));
        const idMap = syncService.idMap;

        // Find requests that exist locally but not on server
        const requestsToRemove = currentRequests.filter(request => {
          const isTempId = request._id?.includes('-');
          if (isTempId) return false;
          return !serverRequestIds.has(request._id) && !idMap[request._id];
        });

        const reconciledServerRequests = get().reconcileIds(serverRequests, idMap);
        const tempIdRequests = currentRequests.filter(r => r._id?.includes('-') && !idMap[r._id]);

        const merged = [...reconciledServerRequests];
        tempIdRequests.forEach(tempRequest => {
          if (!merged.find(r => r._id === tempRequest._id)) {
            merged.push(tempRequest);
          }
        });

        // Save merged to localStorage
        localStorageService.saveRequests(collectionId, merged);

        return merged;
      },

      // Syncs all requests for a project or team at once
      bulkSyncWithServerData: (serverRequests) => {
        // Group server requests by collectionId for easier reconciliation
        const serverRequestsByCollection = serverRequests.reduce((acc, req) => {
          if (!acc[req.collectionId]) acc[req.collectionId] = [];
          acc[req.collectionId].push(req);
          return acc;
        }, {});

        const idMap = syncService.idMap;
        const allLocalRequestsMap = localStorageService.get(localStorageService.KEYS.REQUESTS) || {};
        const updatedLocalRequestsMap = { ...allLocalRequestsMap };

        // Process each collection affected by the server data
        Object.keys(serverRequestsByCollection).forEach(collectionId => {
          const collectionServerReqs = serverRequestsByCollection[collectionId];
          const serverIdsForColl = new Set(collectionServerReqs.map(r => r._id));
          const currentLocalReqs = allLocalRequestsMap[collectionId] || [];

          // 1. Reconcile matching and new items
          const reconciledServerReqs = get().reconcileIds(collectionServerReqs, idMap);

          // 2. Keep local temp-ID requests that haven't synced yet
          const tempIdRequests = currentLocalReqs.filter(r => r._id?.includes('-') && !idMap[r._id]);

          const merged = [...reconciledServerReqs];
          tempIdRequests.forEach(tempReq => {
            if (!merged.find(r => r._id === tempReq._id)) {
              merged.push(tempReq);
            }
          });

          updatedLocalRequestsMap[collectionId] = merged;
        });

        // Optional: Remove local requests for collections that exist in serverData but are empty?
        // Actually, the user wants: "if those request who are present in laocl db but not come in in remove feom local db"
        // This is tricky if serverRequests is only a partial list. 
        // But if syncAll fetches ALL requests for a team, then any local request NOT in the list should be removed.

        // Final save
        set({ requests: serverRequests }); // Update memory state
        localStorageService.set(localStorageService.KEYS.REQUESTS, updatedLocalRequestsMap);

        return updatedLocalRequestsMap;
      },

      reset: () => {
        set({
          currentRequest: defaultRequest(),
          response: null,
          isExecuting: false,
          cancelCurrentRequest: null,
          history: [],
          activeTab: 'params',
          noActiveRequest: false,
          isSaving: false,
          isCreating: false,
          isDeleting: false
        });
      }
    }),
    {
      name: 'syncnest-request',
      partialize: (state) => ({
        currentRequest: state.currentRequest,
        history: state.history,
        openTabs: state.openTabs,
        activeTabId: state.activeTabId
      }),
      merge: (persistedState, currentState) => {
        if (persistedState?.currentRequest) {
          const ensureIds = (arr = []) =>
            arr.map((item) => ({
              ...item,
              id: item.id || (item._id ? String(item._id) : uuidv4()),
            }));
          persistedState.currentRequest.params = ensureIds(persistedState.currentRequest.params);
          persistedState.currentRequest.headers = ensureIds(persistedState.currentRequest.headers);
        }
        if (persistedState?.openTabs) {
          const tabsById = new Map();
          persistedState.openTabs.forEach(tab => {
            tabsById.set(tab.id, tab);
          });
          return { ...currentState, ...persistedState, _tabsById: tabsById };
        }
        return { ...currentState, ...persistedState };
      },
    }
  )
);

export const resetRequestStore = () => useRequestStore.getState().reset();

// Final addition inside the store (re-defining slightly to include reset in the persist block)
// I will just add it to the end of the (set, get) block.
