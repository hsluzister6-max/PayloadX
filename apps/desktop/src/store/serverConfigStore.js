import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const PAYLOADX_SERVER_URL = 'https://payloadx-ykjd.onrender.com';

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

export { PAYLOADX_SERVER_URL };
