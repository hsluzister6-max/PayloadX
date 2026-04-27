import { create } from 'zustand';
import { io } from 'socket.io-client';
import { localStorageService } from '@/services/localStorageService';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export const useSocketStore = create((set, get) => ({
  socket: null,
  isConnected: false,
  roomMembers: [],
  currentRoom: null,
  requestViewers: {}, // { [requestId]: User[] }
  apiDocViewers: {},  // { [endpointId]: User[] }

  connect: () => {
    const existing = get().socket;
    if (existing?.connected) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      set({ isConnected: true });
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      set({ isConnected: false, roomMembers: [] });
    });

    socket.on('room_members', ({ members }) => {
      set({ roomMembers: members });
    });

    socket.on('member_joined', ({ user, members }) => {
      set({ roomMembers: members });
    });

    socket.on('member_left', ({ members }) => {
      set({ roomMembers: members });
    });

    // ── PRESENCE: who is viewing which request ──────────────────────
    socket.on('request_viewers_updated', ({ requestId, viewers }) => {
      set((state) => ({
        requestViewers: { ...state.requestViewers, [requestId]: viewers },
      }));
    });

    socket.on('request_viewers_bulk', ({ presence }) => {
      set((state) => ({
        requestViewers: { ...state.requestViewers, ...presence },
      }));
    });

    socket.on('apidoc_viewers_updated', ({ endpointId, viewers }) => {
      set((state) => ({
        apiDocViewers: { ...state.apiDocViewers, [endpointId]: viewers },
      }));
    });

    set({ socket });
  },

  joinTeam: (teamId, user) => {
    const socket = get().socket;
    if (!socket || !teamId) return;
    socket.emit('join_team', { teamId, user });
    set({ currentRoom: `team:${teamId}` });
  },

  // ── PRESENCE EMITTERS ─────────────────────────────────────────────
  emitOpenRequest: (teamId, requestId, user) => {
    const socket = get().socket;
    if (!socket || !teamId || !requestId) return;
    socket.emit('open_request', { teamId, requestId, user });
  },

  emitCloseRequest: (teamId, requestId, userId) => {
    const socket = get().socket;
    if (!socket || !teamId || !requestId) return;
    socket.emit('close_request', { teamId, requestId, userId });
  },

  emitOpenApiDoc: (teamId, endpointId, user) => {
    const socket = get().socket;
    if (!socket || !teamId || !endpointId) return;
    socket.emit('open_apidoc', { teamId, endpointId, user });
  },

  emitCloseApiDoc: (teamId, endpointId) => {
    const socket = get().socket;
    if (!socket || !teamId || !endpointId) return;
    socket.emit('close_apidoc', { teamId, endpointId });
  },
  // ──────────────────────────────────────────────────────────────────

  emitRequestUpdate: (teamId, request, userId) => {
    const socket = get().socket;
    if (!socket || !teamId) return;
    socket.emit('update_request', { teamId, request, userId });
  },

  emitCollectionUpdate: (teamId, collection, userId) => {
    const socket = get().socket;
    if (!socket || !teamId) return;
    socket.emit('update_collection', { teamId, collection, userId });
  },

  emitCollectionImport: (teamId, collection, requestCount, userId) => {
    const socket = get().socket;
    if (!socket || !teamId) return;
    socket.emit('import_collection', { teamId, collection, requestCount, userId });
  },

  // ── NEW EMITTERS ────────────────────────────────────────────────
  emitRequestCreated: (teamId, request, userId) => {
    const socket = get().socket;
    if (!socket || !teamId) return;
    socket.emit('create_request', { teamId, request, userId });
  },

  emitRequestDeleted: (teamId, collectionId, requestId, userId) => {
    const socket = get().socket;
    if (!socket || !teamId) return;
    socket.emit('delete_request', { teamId, collectionId, requestId, userId });
  },

  emitCollectionCreated: (teamId, collection, userId) => {
    const socket = get().socket;
    if (!socket || !teamId) return;
    socket.emit('create_collection', { teamId, collection, userId });
  },

  emitCollectionDeleted: (teamId, collectionId, userId) => {
    const socket = get().socket;
    if (!socket || !teamId) return;
    socket.emit('delete_collection', { teamId, collectionId, userId });
  },

  emitTeamUpdated: (teamId, team, userId) => {
    const socket = get().socket;
    if (!socket || !teamId) return;
    socket.emit('update_team', { teamId, team, userId });
  },

  emitTeamDeleted: (teamId, userId) => {
    const socket = get().socket;
    if (!socket || !teamId) return;
    socket.emit('delete_team', { teamId, userId });
  },

  emitProjectCreated: (teamId, project, userId) => {
    const socket = get().socket;
    if (!socket || !teamId) return;
    socket.emit('create_project', { teamId, project, userId });
  },

  emitProjectUpdated: (teamId, project, userId) => {
    const socket = get().socket;
    if (!socket || !teamId) return;
    socket.emit('update_project', { teamId, project, userId });
  },

  emitProjectDeleted: (teamId, projectId, userId) => {
    const socket = get().socket;
    if (!socket || !teamId) return;
    socket.emit('delete_project', { teamId, projectId, userId });
  },

  emitWorkflowCreated: (teamId, workflow, userId) => {
    const socket = get().socket;
    if (!socket || !teamId) return;
    socket.emit('create_workflow', { teamId, workflow, userId });
  },

  emitWorkflowUpdated: (teamId, workflow, userId) => {
    const socket = get().socket;
    if (!socket || !teamId) return;
    socket.emit('update_workflow', { teamId, workflow, userId });
  },

  emitWorkflowDeleted: (teamId, workflowId, userId) => {
    const socket = get().socket;
    if (!socket || !teamId) return;
    socket.emit('delete_workflow', { teamId, workflowId, userId });
  },
  // ────────────────────────────────────────────────────────────────

  onRequestUpdated: (callback) => {
    const socket = get().socket;
    if (!socket) return () => { };
    socket.on('request_updated', callback);
    return () => socket.off('request_updated', callback);
  },

  onCollectionUpdated: (callback) => {
    const socket = get().socket;
    if (!socket) return () => { };
    socket.on('collection_updated', callback);
    return () => socket.off('collection_updated', callback);
  },

  onCollectionImported: (callback) => {
    const socket = get().socket;
    if (!socket) return () => { };
    socket.on('collection_imported', callback);
    return () => socket.off('collection_imported', callback);
  },

  // Listen for real-time data updates and sync to localStorage
  onTeamUpdated: (callback) => {
    const socket = get().socket;
    if (!socket) return () => { };
    socket.on('team_updated', (data) => {
      // Update localStorage
      const teams = localStorageService.get(localStorageService.KEYS.TEAMS) || [];
      const updated = teams.map(t => t._id === data.team._id ? data.team : t);
      localStorageService.saveTeams(updated);
      callback(data);
    });
    return () => socket.off('team_updated', callback);
  },

  onTeamDeleted: (callback) => {
    const socket = get().socket;
    if (!socket) return () => { };
    socket.on('team_deleted', (data) => {
      // Update localStorage
      const teams = localStorageService.get(localStorageService.KEYS.TEAMS) || [];
      const updated = teams.filter(t => t._id !== data.teamId);
      localStorageService.saveTeams(updated);
      callback(data);
    });
    return () => socket.off('team_deleted', callback);
  },

  onProjectUpdated: (callback) => {
    const socket = get().socket;
    if (!socket) return () => { };
    socket.on('project_updated', (data) => {
      // Update localStorage
      const projects = localStorageService.get(localStorageService.KEYS.PROJECTS) || [];
      const updated = projects.map(p => p._id === data.project._id ? data.project : p);
      localStorageService.saveProjects(updated);
      callback(data);
    });
    return () => socket.off('project_updated', callback);
  },

  onProjectDeleted: (callback) => {
    const socket = get().socket;
    if (!socket) return () => { };
    socket.on('project_deleted', (data) => {
      // Update localStorage
      const projects = localStorageService.get(localStorageService.KEYS.PROJECTS) || [];
      const updated = projects.filter(p => p._id !== data.projectId);
      localStorageService.saveProjects(updated);
      callback(data);
    });
    return () => socket.off('project_deleted', callback);
  },

  onCollectionUpdated: (callback) => {
    const socket = get().socket;
    if (!socket) return () => { };
    socket.on('collection_updated', (data) => {
      // Update localStorage
      const collections = localStorageService.get(localStorageService.KEYS.COLLECTIONS) || [];
      const updated = collections.map(c => c._id === data.collection._id ? data.collection : c);
      localStorageService.saveCollections(updated);
      callback(data);
    });
    return () => socket.off('collection_updated', callback);
  },

  onCollectionCreated: (callback) => {
    const socket = get().socket;
    if (!socket) return () => { };
    socket.on('collection_created', (data) => {
      // Update localStorage - add new collection if not exists
      const collections = localStorageService.get(localStorageService.KEYS.COLLECTIONS) || [];
      if (!collections.find(c => c._id === data.collection._id)) {
        const updated = [...collections, data.collection];
        localStorageService.saveCollections(updated);
      }
      callback(data);
    });
    return () => socket.off('collection_created', callback);
  },

  onCollectionDeleted: (callback) => {
    const socket = get().socket;
    if (!socket) return () => { };
    socket.on('collection_deleted', (data) => {
      // Update localStorage
      const collections = localStorageService.get(localStorageService.KEYS.COLLECTIONS) || [];
      const updated = collections.filter(c => c._id !== data.collectionId);
      localStorageService.saveCollections(updated);
      callback(data);
    });
    return () => socket.off('collection_deleted', callback);
  },

  onRequestUpdated: (callback) => {
    const socket = get().socket;
    if (!socket) return () => { };
    socket.on('request_updated', (data) => {
      // Update localStorage requests for this collection
      if (data.request?.collectionId) {
        const requests = localStorageService.getRequests(data.request.collectionId);
        const updated = requests.map(r => r._id === data.request._id ? data.request : r);
        localStorageService.saveRequests(data.request.collectionId, updated);
      }
      callback(data);
    });
    return () => socket.off('request_updated', callback);
  },

  onRequestDeleted: (callback) => {
    const socket = get().socket;
    if (!socket) return () => { };
    socket.on('request_deleted', (data) => {
      // Update localStorage requests for this collection
      if (data.collectionId) {
        const requests = localStorageService.getRequests(data.collectionId);
        const updated = requests.filter(r => r._id !== data.requestId);
        localStorageService.saveRequests(data.collectionId, updated);
      }
      callback(data);
    });
    return () => socket.off('request_deleted', callback);
  },

  onRequestCreated: (callback) => {
    const socket = get().socket;
    if (!socket) return () => { };
    socket.on('request_created', (data) => {
      // Update localStorage requests for this collection
      if (data.request?.collectionId) {
        const requests = localStorageService.getRequests(data.request.collectionId);
        const updated = [...requests, data.request];
        localStorageService.saveRequests(data.request.collectionId, updated);
      }
      callback(data);
    });
    return () => socket.off('request_created', callback);
  },

  onWorkflowUpdated: (callback) => {
    const socket = get().socket;
    if (!socket) return () => { };
    socket.on('workflow_updated', callback);
    return () => socket.off('workflow_updated', callback);
  },

  onWorkflowCreated: (callback) => {
    const socket = get().socket;
    if (!socket) return () => { };
    socket.on('workflow_created', callback);
    return () => socket.off('workflow_created', callback);
  },

  onWorkflowDeleted: (callback) => {
    const socket = get().socket;
    if (!socket) return () => { };
    socket.on('workflow_deleted', callback);
    return () => socket.off('workflow_deleted', callback);
  },

  disconnect: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false, roomMembers: [] });
    }
  },
}));
