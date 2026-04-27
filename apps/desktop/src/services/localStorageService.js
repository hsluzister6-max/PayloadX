const PREFIX = 'syncnest_';

const KEYS = {
  TEAMS: `${PREFIX}teams`,
  PROJECTS: `${PREFIX}projects`,
  COLLECTIONS: `${PREFIX}collections`,
  REQUESTS: `${PREFIX}requests`,
  USER: `${PREFIX}user`,
  LAST_SYNC: `${PREFIX}lastSync`,
  PENDING_CHANGES: `${PREFIX}pendingChanges`,
  CURRENT_TEAM: `${PREFIX}currentTeam`,
  CURRENT_PROJECT: `${PREFIX}currentProject`,
  CURRENT_COLLECTION: `${PREFIX}currentCollection`,
  CURRENT_REQUEST: `${PREFIX}currentRequest`,
};

export const localStorageService = {
  KEYS,

  get(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error(`Error reading from localStorage: ${key}`, error);
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error writing to localStorage: ${key}`, error);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing from localStorage: ${key}`, error);
      return false;
    }
  },

  clear() {
    try {
      Object.values(KEYS).forEach(key => localStorage.removeItem(key));
      return true;
    } catch (error) {
      console.error('Error clearing localStorage', error);
      return false;
    }
  },

  getAll() {
    return {
      teams: this.get(KEYS.TEAMS) || [],
      projects: this.get(KEYS.PROJECTS) || [],
      collections: this.get(KEYS.COLLECTIONS) || [],
      requests: this.get(KEYS.REQUESTS) || {},
      user: this.get(KEYS.USER),
      lastSync: this.get(KEYS.LAST_SYNC),
      pendingChanges: this.get(KEYS.PENDING_CHANGES) || [],
      currentTeam: this.get(KEYS.CURRENT_TEAM),
      currentProject: this.get(KEYS.CURRENT_PROJECT),
      currentCollection: this.get(KEYS.CURRENT_COLLECTION),
      currentRequest: this.get(KEYS.CURRENT_REQUEST),
    };
  },

  saveTeams(teams) {
    return this.set(KEYS.TEAMS, teams);
  },

  saveProjects(projects) {
    return this.set(KEYS.PROJECTS, projects);
  },

  saveCollections(collections) {
    return this.set(KEYS.COLLECTIONS, collections);
  },

  saveRequests(collectionId, requests) {
    const allRequests = this.get(KEYS.REQUESTS) || {};
    allRequests[collectionId] = requests;
    return this.set(KEYS.REQUESTS, allRequests);
  },

  getRequests(collectionId) {
    const allRequests = this.get(KEYS.REQUESTS) || {};
    return allRequests[collectionId] || [];
  },

  saveUser(user) {
    return this.set(KEYS.USER, user);
  },

  saveCurrentTeam(team) {
    return this.set(KEYS.CURRENT_TEAM, team);
  },

  saveCurrentProject(project) {
    return this.set(KEYS.CURRENT_PROJECT, project);
  },

  saveCurrentCollection(collection) {
    return this.set(KEYS.CURRENT_COLLECTION, collection);
  },

  saveCurrentRequest(request) {
    return this.set(KEYS.CURRENT_REQUEST, request);
  },

  updateLastSync() {
    return this.set(KEYS.LAST_SYNC, new Date().toISOString());
  },

  addPendingChange(change) {
    const pending = this.get(KEYS.PENDING_CHANGES) || [];
    pending.push({
      ...change,
      timestamp: new Date().toISOString(),
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });
    return this.set(KEYS.PENDING_CHANGES, pending);
  },

  getPendingChanges() {
    return this.get(KEYS.PENDING_CHANGES) || [];
  },

  clearPendingChanges() {
    return this.remove(KEYS.PENDING_CHANGES);
  },

  removePendingChange(changeId) {
    const pending = this.get(KEYS.PENDING_CHANGES) || [];
    const filtered = pending.filter(c => c.id !== changeId);
    return this.set(KEYS.PENDING_CHANGES, filtered);
  },
};
