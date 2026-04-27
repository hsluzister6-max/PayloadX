import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

/**
 * WebSocket Store
 * Manages persistent WS connections, message logs, and connection state.
 * Each connection is keyed by requestId so multiple WS tabs can coexist.
 */
export const useWSStore = create((set, get) => ({
  // { [requestId]: WebSocket instance }
  connections: {},
  // { [requestId]: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error' }
  connectionStatus: {},
  // { [requestId]: [{ id, type, data, timestamp }, ...] }
  logs: {},

  /**
   * Connect to a WebSocket endpoint
   */
  connect: (requestId, url) => {
    const existing = get().connections[requestId];
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return; // Already connected or connecting
    }

    // Update status to connecting
    set((state) => ({
      connectionStatus: { ...state.connectionStatus, [requestId]: 'connecting' },
    }));

    // Add system log
    get().addLog(requestId, 'system', `Connecting to ${url}…`);

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        set((state) => ({
          connectionStatus: { ...state.connectionStatus, [requestId]: 'connected' },
        }));
        get().addLog(requestId, 'system', `Connection established`);
      };

      ws.onmessage = (event) => {
        let data = event.data;
        // Try to pretty-print JSON
        try {
          const parsed = JSON.parse(data);
          data = JSON.stringify(parsed, null, 2);
        } catch {
          // Not JSON, keep as-is
        }
        get().addLog(requestId, 'received', data);
      };

      ws.onerror = (event) => {
        set((state) => ({
          connectionStatus: { ...state.connectionStatus, [requestId]: 'error' },
        }));
        get().addLog(requestId, 'error', 'Connection error occurred');
      };

      ws.onclose = (event) => {
        set((state) => ({
          connectionStatus: { ...state.connectionStatus, [requestId]: 'disconnected' },
        }));
        const reason = event.reason || 'No reason provided';
        const code = event.code;
        get().addLog(requestId, 'system', `Connection closed (code: ${code}, reason: ${reason})`);

        // Clean up the connection reference
        set((state) => {
          const next = { ...state.connections };
          delete next[requestId];
          return { connections: next };
        });
      };

      // Store the WebSocket instance
      set((state) => ({
        connections: { ...state.connections, [requestId]: ws },
      }));
    } catch (err) {
      set((state) => ({
        connectionStatus: { ...state.connectionStatus, [requestId]: 'error' },
      }));
      get().addLog(requestId, 'error', `Failed to connect: ${err.message}`);
    }
  },

  /**
   * Disconnect a specific WebSocket connection
   */
  disconnect: (requestId) => {
    const ws = get().connections[requestId];
    if (ws) {
      ws.close(1000, 'User disconnected');
    }
  },

  /**
   * Send a message over an active WebSocket connection
   */
  sendMessage: (requestId, message) => {
    const ws = get().connections[requestId];
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      get().addLog(requestId, 'error', 'Cannot send — not connected');
      return false;
    }
    try {
      ws.send(message);
      // Try to pretty-print if JSON
      let displayMsg = message;
      try {
        const parsed = JSON.parse(message);
        displayMsg = JSON.stringify(parsed, null, 2);
      } catch {
        // Not JSON
      }
      get().addLog(requestId, 'sent', displayMsg);
      return true;
    } catch (err) {
      get().addLog(requestId, 'error', `Send failed: ${err.message}`);
      return false;
    }
  },

  /**
   * Add a log entry for a specific request
   */
  addLog: (requestId, type, data) => {
    const entry = {
      id: uuidv4(),
      type,      // 'sent' | 'received' | 'system' | 'error'
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

  /**
   * Clear logs for a specific connection
   */
  clearLogs: (requestId) => {
    set((state) => ({
      logs: { ...state.logs, [requestId]: [] },
    }));
  },

  /**
   * Disconnect all active WebSocket connections (cleanup)
   */
  disconnectAll: () => {
    const conns = get().connections;
    Object.values(conns).forEach((ws) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'App cleanup');
      }
    });
    set({ connections: {}, connectionStatus: {} });
  },

  /**
   * Get the status of a specific connection
   */
  getStatus: (requestId) => {
    return get().connectionStatus[requestId] || 'idle';
  },

  /**
   * Get the logs for a specific connection
   */
  getLogs: (requestId) => {
    return get().logs[requestId] || [];
  },

  reset: () => {
    get().disconnectAll();
    set({ logs: {} });
  }
}));
