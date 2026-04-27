import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { io } from 'socket.io-client';

/**
 * Socket.IO Store
 * Manages testing connections to external Socket.IO servers.
 */
export const useSIOStore = create((set, get) => ({
  // { [requestId]: Socket instance }
  connections: {},
  // { [requestId]: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error' }
  connectionStatus: {},
  // { [requestId]: [{ id, type, event, data, timestamp }, ...] }
  logs: {},

  /**
   * Connect to a Socket.IO server
   */
  connect: (requestId, url, options = {}) => {
    const existing = get().connections[requestId];
    if (existing && existing.connected) return;

    set((state) => ({
      connectionStatus: { ...state.connectionStatus, [requestId]: 'connecting' },
    }));

    get().addLog(requestId, 'system', 'Connecting...', url);

    try {
      // Map Request options to Socket.IO options
      const ioOptions = {
        reconnection: false,
        transports: ['websocket', 'polling'],
        ...options
      };

      const socket = io(url, ioOptions);

      socket.on('connect', () => {
        set((state) => ({
          connectionStatus: { ...state.connectionStatus, [requestId]: 'connected' },
        }));
        get().addLog(requestId, 'system', 'Connected', socket.id);
      });

      // Listen to all events (Wildcard)
      socket.onAny((event, ...args) => {
        let displayData = args.length === 1 ? args[0] : args;
        try {
          if (typeof displayData === 'object') {
            displayData = JSON.stringify(displayData, null, 2);
          }
        } catch {}
        get().addLog(requestId, 'received', displayData, event);
      });

      socket.on('connect_error', (err) => {
        set((state) => ({
          connectionStatus: { ...state.connectionStatus, [requestId]: 'error' },
        }));
        get().addLog(requestId, 'error', `Connection error: ${err.message}`);
      });

      socket.on('disconnect', (reason) => {
        set((state) => ({
          connectionStatus: { ...state.connectionStatus, [requestId]: 'disconnected' },
        }));
        get().addLog(requestId, 'system', `Disconnected: ${reason}`);
      });

      set((state) => ({
        connections: { ...state.connections, [requestId]: socket },
      }));
    } catch (err) {
      set((state) => ({
        connectionStatus: { ...state.connectionStatus, [requestId]: 'error' },
      }));
      get().addLog(requestId, 'error', `Initialization failed: ${err.message}`);
    }
  },

  disconnect: (requestId) => {
    const socket = get().connections[requestId];
    if (socket) {
      socket.disconnect();
    }
  },

  emit: (requestId, event, data) => {
    const socket = get().connections[requestId];
    if (!socket || !socket.connected) {
      get().addLog(requestId, 'error', 'Cannot emit — not connected');
      return false;
    }

    try {
      let args = [];
      // If data is a JSON array string, parse and spread it
      try {
        const parsed = JSON.parse(data);
        args = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Not valid JSON or not an array, send as single string argument
        args = [data];
      }

      socket.emit(event, ...args);
      
      let displayData = args.length === 1 ? args[0] : args;
      try {
        if (typeof displayData === 'object') {
          displayData = JSON.stringify(displayData, null, 2);
        }
      } catch {}
      
      get().addLog(requestId, 'sent', displayData, event);
      return true;
    } catch (err) {
      get().addLog(requestId, 'error', `Emit failed: ${err.message}`);
      return false;
    }
  },

  addLog: (requestId, type, data, eventName = null) => {
    const entry = {
      id: uuidv4(),
      type, // 'sent' | 'received' | 'system' | 'error'
      event: eventName,
      data,
      timestamp: Date.now(),
    };
    set((state) => ({
      logs: {
        ...state.logs,
        [requestId]: [...(state.logs[requestId] || []), entry],
      },
    }));
  },

  clearLogs: (requestId) => {
    set((state) => ({
      logs: { ...state.logs, [requestId]: [] },
    }));
  },

  disconnectAll: () => {
    const { connections } = get();
    Object.values(connections).forEach((s) => s.disconnect());
    set({ connections: {}, connectionStatus: {} });
  },

  reset: () => {
    get().disconnectAll();
    set({ logs: {} });
  }
}));
