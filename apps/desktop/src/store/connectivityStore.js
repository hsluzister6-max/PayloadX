import { create } from 'zustand';

export const useConnectivityStore = create((set, get) => ({
  hasInternet: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isBackendReachable: typeof navigator !== 'undefined' ? navigator.onLine : true,
  
  startHeartbeat: () => {
    const handleOnline = () => {
      set({ hasInternet: true, isBackendReachable: true });
    };
    
    const handleOffline = () => {
      set({ hasInternet: false, isBackendReachable: false });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    set({
      hasInternet: navigator.onLine,
      isBackendReachable: navigator.onLine
    });
  },

  stopHeartbeat: () => {
    // Window listeners are typically fine to leave, but we can clean them up if needed.
    // Assuming start/stop heartbeat are called carefully.
    // If you need exact cleanup, store references to the functions.
  }
}));
