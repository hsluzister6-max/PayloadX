import { localStorageService } from './localStorageService';
import api from '@/lib/api';
import { isMongoObjectId, isTempId, stripTempIds } from '@/utils/tempId';

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
    this.listeners.forEach((listener) => listener(event));
  }

  getOnlineStatus() {
    return this.isOnline;
  }

  registerIdMapping(tempId, realId) {
    if (!tempId || !realId || tempId === realId) return;
    this.idMap[tempId] = realId;
    localStorageService.set('syncnest_id_map', this.idMap);
  }

  resolveEntityId(id) {
    if (!id) return id;
    return this.idMap[id] || id;
  }

  /** Still a local-only id after idMap resolve — must create, never PUT/DELETE. */
  stillTemp(id) {
    const realId = this.resolveEntityId(id);
    return isTempId(realId) || !isMongoObjectId(realId);
  }

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

  async syncPendingChanges() {
    if (this.syncInProgress || !this.isOnline) return;

    this.syncInProgress = true;
    this.notifyListeners({ type: 'sync-start' });

    const pending = localStorageService.getPendingChanges() || [];
    const results = [];

    // Creates before updates/deletes so temp→real mappings exist.
    const order = { create: 0, update: 1, delete: 2 };
    const rank = (type = '') => {
      if (type.startsWith('create_') || type.startsWith('add_')) return order.create;
      if (type.startsWith('delete_')) return order.delete;
      return order.update;
    };
    const sorted = [...pending].sort((a, b) => rank(a.type) - rank(b.type) || a.timestamp - b.timestamp);

    for (const change of sorted) {
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
    this.refreshAllStores();
  }

  async applyChange(change) {
    console.log('Applying pending change:', change);

    const { type, data } = change;
    const resolvedData = this.resolveIds(data);

    const syncApi = {
      post: (url, body) => api.post(url, body, { isSyncOperation: true }),
      put: (url, body) => api.put(url, body, { isSyncOperation: true }),
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

  // ── Creates ──────────────────────────────────────────────────────────────
  async syncCreateTeam(data, syncApi) {
    const { tempId, ...raw } = data;
    const teamData = stripTempIds(raw);
    const response = await syncApi.post('/api/team', teamData);
    const realId = response.data?.team?._id;
    if ((tempId || raw._id) && realId) {
      this.registerIdMapping(tempId || raw._id, realId);
    }
    return response.data;
  }

  async syncCreateProject(data, syncApi) {
    const { tempId, ...raw } = data;
    const projectData = stripTempIds({
      ...raw,
      teamId: this.resolveEntityId(raw.teamId),
    });
    const response = await syncApi.post('/api/project', projectData);
    const realId = response.data?.project?._id;
    if ((tempId || raw._id) && realId) {
      this.registerIdMapping(tempId || raw._id, realId);
    }
    return response.data;
  }

  async syncCreateCollection(data, syncApi) {
    const { tempId, ...raw } = data;
    const collectionData = stripTempIds({
      ...raw,
      projectId: this.resolveEntityId(raw.projectId),
      teamId: this.resolveEntityId(raw.teamId),
    });
    const response = await syncApi.post('/api/collection', collectionData);
    const realId = response.data?.collection?._id;
    if ((tempId || raw._id) && realId) {
      this.registerIdMapping(tempId || raw._id, realId);
    }
    return response.data;
  }

  async syncCreateRequest(data, syncApi) {
    const { tempId, ...raw } = data;
    const requestData = stripTempIds({
      ...raw,
      collectionId: this.resolveEntityId(raw.collectionId),
      projectId: this.resolveEntityId(raw.projectId),
      teamId: this.resolveEntityId(raw.teamId),
      folderId: raw.folderId ? this.resolveEntityId(raw.folderId) : raw.folderId,
    });
    const response = await syncApi.post('/api/request', requestData);
    const realId = response.data?.request?._id;
    if ((tempId || raw._id) && realId) {
      this.registerIdMapping(tempId || raw._id, realId);
    }
    return response.data;
  }

  async syncCreateEnvironment(data, syncApi) {
    const { tempId, ...raw } = data;
    const environmentData = stripTempIds({
      ...raw,
      projectId: this.resolveEntityId(raw.projectId),
      teamId: this.resolveEntityId(raw.teamId),
    });
    const response = await syncApi.post('/api/environment', environmentData);
    const realId = response.data?.environment?._id;
    if ((tempId || raw._id) && realId) {
      this.registerIdMapping(tempId || raw._id, realId);
    }
    return response.data;
  }

  // ── Updates (temp → create) ──────────────────────────────────────────────
  async syncUpdateTeam(data, syncApi) {
    const { id, ...updateData } = data;
    if (this.stillTemp(id)) {
      return this.syncCreateTeam({ ...updateData, tempId: id }, syncApi);
    }
    const realId = this.resolveEntityId(id);
    const response = await syncApi.put(`/api/team/${realId}`, stripTempIds(updateData));
    return response.data;
  }

  async syncUpdateProject(data, syncApi) {
    const { id, ...updateData } = data;
    if (this.stillTemp(id)) {
      return this.syncCreateProject({ ...updateData, tempId: id }, syncApi);
    }
    const realId = this.resolveEntityId(id);
    const response = await syncApi.put(`/api/project/${realId}`, stripTempIds(updateData));
    return response.data;
  }

  async syncUpdateCollection(data, syncApi) {
    const { id, ...updateData } = data;
    if (this.stillTemp(id)) {
      return this.syncCreateCollection({ ...updateData, tempId: id }, syncApi);
    }
    const realId = this.resolveEntityId(id);
    const response = await syncApi.put(`/api/collection/${realId}`, stripTempIds(updateData));
    return response.data;
  }

  async syncUpdateRequest(data, syncApi) {
    const { id, ...updateData } = data;
    if (this.stillTemp(id)) {
      return this.syncCreateRequest({ ...updateData, tempId: id }, syncApi);
    }
    const realId = this.resolveEntityId(id);
    const response = await syncApi.put(`/api/request/${realId}`, stripTempIds(updateData));
    return response.data;
  }

  async syncUpdateEnvironment(data, syncApi) {
    const { id, ...updateData } = data;
    if (this.stillTemp(id)) {
      return this.syncCreateEnvironment({ ...updateData, tempId: id }, syncApi);
    }
    const realId = this.resolveEntityId(id);
    const response = await syncApi.put(`/api/environment/${realId}`, stripTempIds(updateData));
    return response.data;
  }

  async syncUpdateEnvironmentVariables(data, syncApi) {
    const { id, variables } = data;
    if (this.stillTemp(id)) {
      return this.syncCreateEnvironment({ _id: id, tempId: id, variables }, syncApi);
    }
    const realId = this.resolveEntityId(id);
    const response = await syncApi.put(`/api/environment/${realId}/variables`, { variables });
    return response.data;
  }

  async syncAddEnvironmentVariable(data, syncApi) {
    const { envId, variable } = data;
    if (this.stillTemp(envId)) {
      return this.syncCreateEnvironment({
        tempId: envId,
        variables: variable ? [variable] : [],
      }, syncApi);
    }
    const realEnvId = this.resolveEntityId(envId);
    const response = await syncApi.post(`/api/environment/${realEnvId}/variables`, variable);
    return response.data;
  }

  // ── Deletes (temp → no-op) ───────────────────────────────────────────────
  async syncDeleteTeam(data, syncApi) {
    const { id } = data;
    if (this.stillTemp(id)) return { success: true, skipped: true };
    const realId = this.resolveEntityId(id);
    await syncApi.delete(`/api/team/${realId}`);
    return { success: true };
  }

  async syncDeleteProject(data, syncApi) {
    const { id } = data;
    if (this.stillTemp(id)) return { success: true, skipped: true };
    const realId = this.resolveEntityId(id);
    await syncApi.delete(`/api/project/${realId}`);
    return { success: true };
  }

  async syncDeleteCollection(data, syncApi) {
    const { id } = data;
    if (this.stillTemp(id)) return { success: true, skipped: true };
    const realId = this.resolveEntityId(id);
    await syncApi.delete(`/api/collection/${realId}`);
    return { success: true };
  }

  async syncDeleteRequest(data, syncApi) {
    const { id, collectionId } = data;
    if (this.stillTemp(id)) return { success: true, skipped: true };
    const realId = this.resolveEntityId(id);
    const realCollectionId = this.resolveEntityId(collectionId);
    await syncApi.delete(`/api/request/${realId}`, {
      params: { collectionId: realCollectionId },
    });
    return { success: true };
  }

  async syncDeleteEnvironment(data, syncApi) {
    const { id } = data;
    if (this.stillTemp(id)) return { success: true, skipped: true };
    const realId = this.resolveEntityId(id);
    await syncApi.delete(`/api/environment/${realId}`);
    return { success: true };
  }

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

  refreshAllStores() {
    const stores = window.__SYNCNEST_STORES__;
    if (stores) {
      Object.values(stores).forEach((store) => {
        if (store && typeof store.refresh === 'function') {
          store.refresh();
        }
      });
    }
  }

  clearIdMappings() {
    this.idMap = {};
    localStorageService.set('syncnest_id_map', {});
  }
}

export const syncService = new SyncService();
