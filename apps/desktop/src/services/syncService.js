import { localStorageService } from './localStorageService';
import api from '@/lib/api';

class SyncService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = new Set();
    this.syncInProgress = false;
    this.idMap = {}; // Maps temp IDs to real MongoDB IDs

    // Load existing ID mappings from localStorage
    const savedIdMap = localStorageService.get('syncnest_id_map');
    if (savedIdMap) {
      this.idMap = savedIdMap;
    }

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners({ type: 'online' });
      this.syncPendingChanges();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners({ type: 'offline' });
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(event) {
    this.listeners.forEach(listener => listener(event));
  }

  getOnlineStatus() {
    return this.isOnline;
  }

  // Register a mapping from temp ID to real ID
  registerIdMapping(tempId, realId) {
    if (!tempId || !realId || tempId === realId) return;
    this.idMap[tempId] = realId;
    // Persist to localStorage
    localStorageService.set('syncnest_id_map', this.idMap);
  }

  // Resolve any temp IDs in a string or object to real IDs
  resolveIds(data) {
    if (typeof data === 'string') {
      let result = data;
      Object.entries(this.idMap).forEach(([tempId, realId]) => {
        result = result.split(tempId).join(realId);
      });
      return result;
    }
    if (typeof data === 'object' && data !== null) {
      const str = JSON.stringify(data);
      let resolved = str;
      Object.entries(this.idMap).forEach(([tempId, realId]) => {
        resolved = resolved.split(tempId).join(realId);
      });
      return JSON.parse(resolved);
    }
    return data;
  }

  // Sync all pending changes when coming online
  async syncPendingChanges() {
    if (this.syncInProgress || !this.isOnline) return;

    this.syncInProgress = true;
    this.notifyListeners({ type: 'sync-start' });

    const pending = localStorageService.getPendingChanges() || [];
    const results = [];

    for (const change of pending) {
      try {
        const result = await this.applyChange(change);
        localStorageService.removePendingChange(change.id);
        results.push({ success: true, change, result });
      } catch (error) {
        console.error('Failed to sync change:', change, error);
        results.push({ success: false, change, error });
      }
    }

    this.syncInProgress = false;
    localStorageService.updateLastSync();
    this.notifyListeners({ type: 'sync-complete', results });
    
    // Refresh all stores after sync to get latest data
    this.refreshAllStores();
  }

  // Apply a single pending change
  async applyChange(change) {
    console.log('Applying pending change:', change);
    
    const { type, data } = change;
    
    // Resolve any temp IDs in the data
    const resolvedData = this.resolveIds(data);
    
    // Create syncApi wrapper - adds isSyncOperation flag to prevent logout on 401
    const syncApi = {
      post: (url, data) => api.post(url, data, { isSyncOperation: true }),
      put: (url, data) => api.put(url, data, { isSyncOperation: true }),
      delete: (url, config = {}) => api.delete(url, { ...config, isSyncOperation: true }),
    };

    switch (type) {
      case 'create_team':
        return this.syncCreateTeam(resolvedData, syncApi);
      case 'create_project':
        return this.syncCreateProject(resolvedData, syncApi);
      case 'create_collection':
        return this.syncCreateCollection(resolvedData, syncApi);
      case 'create_request':
        return this.syncCreateRequest(resolvedData, syncApi);
      case 'update_team':
        return this.syncUpdateTeam(resolvedData, syncApi);
      case 'update_project':
        return this.syncUpdateProject(resolvedData, syncApi);
      case 'update_collection':
        return this.syncUpdateCollection(resolvedData, syncApi);
      case 'update_request':
        return this.syncUpdateRequest(resolvedData, syncApi);
      case 'delete_team':
        return this.syncDeleteTeam(resolvedData, syncApi);
      case 'delete_project':
        return this.syncDeleteProject(resolvedData, syncApi);
      case 'delete_collection':
        return this.syncDeleteCollection(resolvedData, syncApi);
      case 'delete_request':
        return this.syncDeleteRequest(resolvedData, syncApi);
      case 'create_environment':
        return this.syncCreateEnvironment(resolvedData, syncApi);
      case 'update_environment':
        return this.syncUpdateEnvironment(resolvedData, syncApi);
      case 'delete_environment':
        return this.syncDeleteEnvironment(resolvedData, syncApi);
      case 'update_environment_variables':
        return this.syncUpdateEnvironmentVariables(resolvedData, syncApi);
      case 'add_environment_variable':
        return this.syncAddEnvironmentVariable(resolvedData, syncApi);
      default:
        throw new Error(`Unknown change type: ${type}`);
    }
  }

  // Sync operations - use syncApi to prevent logout on 401 errors
  async syncCreateTeam(data, syncApi) {
    const { tempId, ...teamData } = data;
    const response = await syncApi.post('/api/team', teamData);
    if (tempId && response.data?.team?._id) {
      this.registerIdMapping(tempId, response.data.team._id);
    }
    return response.data;
  }

  async syncCreateProject(data, syncApi) {
    const { tempId, ...projectData } = data;
    const response = await syncApi.post('/api/project', projectData);
    if (tempId && response.data?.project?._id) {
      this.registerIdMapping(tempId, response.data.project._id);
    }
    return response.data;
  }

  async syncCreateCollection(data, syncApi) {
    const { tempId, ...collectionData } = data;
    const response = await syncApi.post('/api/collection', collectionData);
    if (tempId && response.data?.collection?._id) {
      this.registerIdMapping(tempId, response.data.collection._id);
    }
    return response.data;
  }

  async syncCreateRequest(data, syncApi) {
    const { tempId, ...requestData } = data;
    const response = await syncApi.post('/api/request', requestData);
    if (tempId && response.data?.request?._id) {
      this.registerIdMapping(tempId, response.data.request._id);
    }
    return response.data;
  }

  async syncUpdateTeam(data, syncApi) {
    const { id, ...updateData } = data;
    const realId = this.idMap[id] || id;
    const response = await syncApi.put(`/api/team/${realId}`, updateData);
    return response.data;
  }

  async syncUpdateProject(data, syncApi) {
    const { id, ...updateData } = data;
    const realId = this.idMap[id] || id;
    const response = await syncApi.put(`/api/project/${realId}`, updateData);
    return response.data;
  }

  async syncUpdateCollection(data, syncApi) {
    const { id, ...updateData } = data;
    const realId = this.idMap[id] || id;
    const response = await syncApi.put(`/api/collection/${realId}`, updateData);
    return response.data;
  }

  async syncUpdateRequest(data, syncApi) {
    const { id, ...updateData } = data;
    const realId = this.idMap[id] || id;
    const response = await syncApi.put(`/api/request/${realId}`, updateData);
    return response.data;
  }

  async syncDeleteTeam(data, syncApi) {
    const { id } = data;
    const realId = this.idMap[id] || id;
    await syncApi.delete(`/api/team/${realId}`);
    return { success: true };
  }

  async syncDeleteProject(data, syncApi) {
    const { id } = data;
    const realId = this.idMap[id] || id;
    await syncApi.delete(`/api/project/${realId}`);
    return { success: true };
  }

  async syncDeleteCollection(data, syncApi) {
    const { id } = data;
    const realId = this.idMap[id] || id;
    await syncApi.delete(`/api/collection/${realId}`);
    return { success: true };
  }

  async syncDeleteRequest(data, syncApi) {
    const { id, collectionId } = data;
    const realId = this.idMap[id] || id;
    const realCollectionId = this.idMap[collectionId] || collectionId;
    await syncApi.delete(`/api/request/${realId}`, { 
      params: { collectionId: realCollectionId }
    });
    return { success: true };
  }

  async syncCreateEnvironment(data, syncApi) {
    const { tempId, ...environmentData } = data;
    const response = await syncApi.post('/api/environment', environmentData);
    if (tempId && response.data?.environment?._id) {
      this.registerIdMapping(tempId, response.data.environment._id);
    }
    return response.data;
  }

  async syncUpdateEnvironment(data, syncApi) {
    const { id, ...updateData } = data;
    const realId = this.idMap[id] || id;
    const response = await syncApi.put(`/api/environment/${realId}`, updateData);
    return response.data;
  }

  async syncDeleteEnvironment(data, syncApi) {
    const { id } = data;
    const realId = this.idMap[id] || id;
    await syncApi.delete(`/api/environment/${realId}`);
    return { success: true };
  }

  async syncUpdateEnvironmentVariables(data, syncApi) {
    const { id, variables } = data;
    const realId = this.idMap[id] || id;
    const response = await syncApi.put(`/api/environment/${realId}/variables`, { variables });
    return response.data;
  }

  async syncAddEnvironmentVariable(data, syncApi) {
    const { envId, variable } = data;
    const realEnvId = this.idMap[envId] || envId;
    const response = await syncApi.post(`/api/environment/${realEnvId}/variables`, variable);
    return response.data;
  }

  // Queue a change for sync
  queueChange(type, data, tempId = null) {
    const change = {
      id: tempId || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data: { ...data, tempId },
      timestamp: Date.now(),
    };
    
    localStorageService.addPendingChange(change);
    this.notifyListeners({ type: 'change-queued', change });

    if (this.isOnline) {
      this.syncPendingChanges();
    }
    
    return change;
  }

  // Refresh all stores after sync
  refreshAllStores() {
    // Trigger refresh on all stores
    const stores = window.__SYNCNEST_STORES__;
    if (stores) {
      Object.values(stores).forEach(store => {
        if (store && typeof store.refresh === 'function') {
          store.refresh();
        }
      });
    }
  }

  // Clear all ID mappings
  clearIdMappings() {
    this.idMap = {};
    localStorageService.set('syncnest_id_map', {});
  }
}

export const syncService = new SyncService();
