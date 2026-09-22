import { create } from 'zustand';
import { io } from 'socket.io-client';
import { localStorageService } from '@/services/localStorageService';
import { getServerBaseUrl } from '@/store/serverConfigStore';
import { idStr, idsEqual } from '@/utils/ids';

function onSocketEvent(socket, event, handler) {
  if (!socket) return () => { };
  socket.on(event, handler);
  return () => socket.off(event, handler);
}

export const useSocketStore = create((set, get) => ({
  socket: null,
  isConnected: false,
  roomMembers: [],
  currentRoom: null,
  requestViewers: {}, // { [requestId]: User[] }
  apiDocViewers: {},  // { [endpointId]: User[] }

  connect: () => {
    // Always follow the active server selection:
    //   cloud (payloadx) → https://payload-x-884697093779.europe-west1.run.app
    //   local            → URL the user entered
    const SOCKET_URL = getServerBaseUrl();

    const existing = get().socket;
    if (existing) {
      const targetHost = (() => {
        try { return new URL(SOCKET_URL).host; } catch { return SOCKET_URL; }
      })();
      // Prefer manager URI (stable even while still connecting)
      const existingUri = String(existing.io?.uri || existing.io?.opts?.hostname || '');
      const sameHost = existingUri.includes(targetHost);

      // Same host: keep the in-flight / live socket (avoids Strict Mode
      // double-mount tearing down a websocket mid-handshake).
      if (sameHost) return;

      // Different host (cloud ↔ local switch): tear down and reconnect.
      existing.removeAllListeners();
      existing.disconnect();
      set({ socket: null, isConnected: false, roomMembers: [] });
    }

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id, '→', SOCKET_URL);
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
    const handler = (data) => {
      const request = data?.request;
      if (request?.collectionId) {
        const cid = idStr(request.collectionId);
        const key = idStr(request._id);
        const requests = localStorageService.getRequests(cid);
        const exists = requests.some((r) => idStr(r._id) === key);
        const updated = exists
          ? requests.map((r) => (idStr(r._id) === key ? request : r))
          : [...requests, request];
        localStorageService.saveRequests(cid, updated);
      }
      callback(data);
    };
    return onSocketEvent(socket, 'request_updated', handler);
  },

  onCollectionImported: (callback) => {
    const socket = get().socket;
    return onSocketEvent(socket, 'collection_imported', callback);
  },

  onTeamUpdated: (callback) => {
    const socket = get().socket;
    const handler = (data) => {
      const teams = localStorageService.get(localStorageService.KEYS.TEAMS) || [];
      const updated = teams.map((t) => (idsEqual(t._id, data.team?._id) ? data.team : t));
      localStorageService.saveTeams(updated);
      callback(data);
    };
    return onSocketEvent(socket, 'team_updated', handler);
  },

  onTeamDeleted: (callback) => {
    const socket = get().socket;
    const handler = (data) => {
      const teams = localStorageService.get(localStorageService.KEYS.TEAMS) || [];
      const updated = teams.filter((t) => !idsEqual(t._id, data.teamId));
      localStorageService.saveTeams(updated);
      callback(data);
    };
    return onSocketEvent(socket, 'team_deleted', handler);
  },

  onProjectUpdated: (callback) => {
    const socket = get().socket;
    const handler = (data) => {
      const projects = localStorageService.get(localStorageService.KEYS.PROJECTS) || [];
      const updated = projects.map((p) => (idsEqual(p._id, data.project?._id) ? data.project : p));
      localStorageService.saveProjects(updated);
      callback(data);
    };
    return onSocketEvent(socket, 'project_updated', handler);
  },

  onProjectDeleted: (callback) => {
    const socket = get().socket;
    const handler = (data) => {
      const projects = localStorageService.get(localStorageService.KEYS.PROJECTS) || [];
      const updated = projects.filter((p) => !idsEqual(p._id, data.projectId));
      localStorageService.saveProjects(updated);
      callback(data);
    };
    return onSocketEvent(socket, 'project_deleted', handler);
  },

  onCollectionUpdated: (callback) => {
    const socket = get().socket;
    const handler = (data) => {
      const collections = localStorageService.get(localStorageService.KEYS.COLLECTIONS) || [];
      const updated = collections.map((c) => (idsEqual(c._id, data.collection?._id) ? data.collection : c));
      localStorageService.saveCollections(updated);
      callback(data);
    };
    return onSocketEvent(socket, 'collection_updated', handler);
  },

  onCollectionCreated: (callback) => {
    const socket = get().socket;
    const handler = (data) => {
      const collections = localStorageService.get(localStorageService.KEYS.COLLECTIONS) || [];
      if (!collections.find((c) => idsEqual(c._id, data.collection?._id))) {
        localStorageService.saveCollections([...collections, data.collection]);
      }
      callback(data);
    };
    return onSocketEvent(socket, 'collection_created', handler);
  },

  onCollectionDeleted: (callback) => {
    const socket = get().socket;
    const handler = (data) => {
      const collections = localStorageService.get(localStorageService.KEYS.COLLECTIONS) || [];
      const updated = collections.filter((c) => !idsEqual(c._id, data.collectionId));
      localStorageService.saveCollections(updated);
      callback(data);
    };
    return onSocketEvent(socket, 'collection_deleted', handler);
  },

  onRequestDeleted: (callback) => {
    const socket = get().socket;
    const handler = (data) => {
      if (data.collectionId) {
        const requests = localStorageService.getRequests(data.collectionId);
        const updated = requests.filter((r) => !idsEqual(r._id, data.requestId));
        localStorageService.saveRequests(idStr(data.collectionId), updated);
      }
      callback(data);
    };
    return onSocketEvent(socket, 'request_deleted', handler);
  },

  onRequestCreated: (callback) => {
    const socket = get().socket;
    const handler = (data) => {
      const request = data?.request;
      if (request?.collectionId) {
        const cid = idStr(request.collectionId);
        const key = idStr(request._id);
        const requests = localStorageService.getRequests(cid);
        if (!requests.some((r) => idStr(r._id) === key)) {
          localStorageService.saveRequests(cid, [...requests, request]);
        }
      }
      callback(data);
    };
    return onSocketEvent(socket, 'request_created', handler);
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
