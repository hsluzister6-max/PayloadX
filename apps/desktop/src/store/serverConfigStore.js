import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Cloud backend + Socket.IO (same host on Cloud Run). */
export const PAYLOADX_SERVER_URL = 'https://payload-x-884697093779.europe-west1.run.app';

export const useServerConfigStore = create(
  persist(
    (set, get) => ({
      // 'payloadx' | 'local'
      serverMode: null,
      customUrl: '',

      get baseUrl() {
        const { serverMode, customUrl } = get();
        if (serverMode === 'local') {
          return customUrl?.replace(/\/$/, '') || 'http://localhost:3001';
        }
        return PAYLOADX_SERVER_URL;
      },

      setServerMode: (mode) => set({ serverMode: mode }),
      setCustomUrl: (url) => set({ customUrl: url }),

      reset: () => set({ serverMode: null, customUrl: '' }),
    }),
    {
      name: 'payloadx-server-config',
    }
  )
);

/** Resolve the active API / Socket base URL from current server config. */
export function getServerBaseUrl() {
  const { serverMode, customUrl } = useServerConfigStore.getState();
  if (serverMode === 'local') {
    return customUrl?.replace(/\/$/, '') || 'http://localhost:3001';
  }
  return PAYLOADX_SERVER_URL;
}
