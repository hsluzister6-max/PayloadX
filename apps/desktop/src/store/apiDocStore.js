import { create } from 'zustand';
import api from '@/lib/api';
import { useSocketStore } from './socketStore';
import { useTeamStore } from './teamStore';
import { useAuthStore } from './authStore';
import toast from 'react-hot-toast';

export const useApiDocStore = create((set, get) => ({
  docs: [],
  currentDoc: null,
  currentEndpoint: null,
  isLoading: false,

  fetchDocs: async (projectId) => {
    if (!projectId) return;
    set({ isLoading: true });
    try {
      const { data } = await api.get('/api/apidoc', { params: { projectId } });
      set({ docs: data.docs, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchDocDetail: async (id) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/api/apidoc/${id}`);
      set({ currentDoc: data.doc, isLoading: false });
      
      // If current endpoint belongs to this doc, update it
      const { currentEndpoint } = get();
      if (currentEndpoint) {
         const updatedEndpoint = data.doc.endpoints.find(e => e.id === currentEndpoint.id);
         if (updatedEndpoint) set({ currentEndpoint: updatedEndpoint });
      }
      return data.doc;
    } catch {
      set({ isLoading: false });
      return null;
    }
  },

  createDoc: async (payload) => {
    try {
      const { data } = await api.post('/api/apidoc', payload);
      set((state) => ({ docs: [data.doc, ...state.docs] }));
      toast.success('Doc created');
      return data.doc;
    } catch (err) {
      toast.error('Failed to create doc');
      return null;
    }
  },

  updateDoc: async (id, patch) => {
    try {
      const { data } = await api.put(`/api/apidoc/${id}`, patch);
      // Update local state immediately
      set((state) => {
        const docs = state.docs.map(d => d._id === id ? { ...d, ...patch } : d);
        let currentDoc = state.currentDoc;
        if (currentDoc?._id === id) {
           currentDoc = { ...currentDoc, ...patch };
        }
        return { docs, currentDoc };
      });
      return data.doc;
    } catch (err) {
      toast.error('Failed to update doc');
      return null;
    }
  },

  deleteDoc: async (id) => {
    try {
      await api.delete(`/api/apidoc/${id}`);
      set((state) => ({
        docs: state.docs.filter((d) => d._id !== id),
        currentDoc: state.currentDoc?._id === id ? null : state.currentDoc,
        currentEndpoint: state.currentDoc?._id === id ? null : state.currentEndpoint,
      }));
      toast.success('Doc deleted');
      return true;
    } catch (err) {
      toast.error('Failed to delete doc');
      return false;
    }
  },

  // ── Endpoints ──

  addEndpoint: async (docId, endpoint) => {
    try {
      const { data } = await api.post(`/api/apidoc/${docId}/endpoints`, { endpoint });
      set({ currentDoc: data.doc });
      
      get().emitDocUpdate(data.doc);
      return data.doc;
    } catch (err) {
      toast.error('Failed to add endpoint');
      return null;
    }
  },

  updateEndpoint: async (docId, endpoint) => {
    try {
      const { data } = await api.put(`/api/apidoc/${docId}/endpoints`, { endpoint });
      set({ currentDoc: data.doc });
      
      const { currentEndpoint } = get();
      if (currentEndpoint?.id === endpoint.id) {
         set({ currentEndpoint: endpoint });
      }

      get().emitDocUpdate(data.doc);
      return data.doc;
    } catch (err) {
      toast.error('Failed to update endpoint');
      return null;
    }
  },

  deleteEndpoint: async (docId, endpointId) => {
    try {
      const { data } = await api.delete(`/api/apidoc/${docId}/endpoints?endpointId=${endpointId}`);
      set({ currentDoc: data.doc });
      
      const { currentEndpoint } = get();
      if (currentEndpoint?.id === endpointId) {
         set({ currentEndpoint: null });
      }

      get().emitDocUpdate(data.doc);
      return data.doc;
    } catch (err) {
      toast.error('Failed to delete endpoint');
      return null;
    }
  },

  // ── Local State Setters ──

  setCurrentDoc: (doc) => set({ currentDoc: doc }),
  setCurrentEndpoint: (endpoint) => set({ currentEndpoint: endpoint }),

  // ── Emits to socket ──
  emitDocUpdate: (doc) => {
    const socket = useSocketStore.getState().socket;
    const teamId = useTeamStore.getState().currentTeam?._id;
    const user = useAuthStore.getState().user;
    if (socket && teamId) {
      socket.emit('update_apidoc', { teamId, doc, userId: user?.id });
    }
  },
}));
