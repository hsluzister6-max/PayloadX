import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/tauri';
import toast from 'react-hot-toast';

export const useCookieStore = create((set, get) => ({
  domains: [],
  currentCookies: {}, // key-value pairs for the selected domain
  selectedDomain: null,
  loading: false,

  fetchDomains: async () => {
    try {
      const domains = await invoke('list_cookie_domains');
      set({ domains });
    } catch (error) {
      console.error('Failed to fetch cookie domains:', error);
    }
  },

  fetchCookies: async (domain) => {
    if (!domain) return;
    set({ loading: true, selectedDomain: domain });
    try {
      const cookies = await invoke('get_cookies', { host: domain });
      set({ currentCookies: cookies, loading: false });
    } catch (error) {
      console.error('Failed to fetch cookies:', error);
      set({ loading: false });
    }
  },

  addCookie: async (domain, key, value) => {
    try {
      await invoke('set_cookie', { host: domain, key, value });
      await get().fetchCookies(domain);
      if (!get().domains.includes(domain)) {
        await get().fetchDomains();
      }
      toast.success(`Cookie "${key}" added`);
    } catch (error) {
      toast.error('Failed to add cookie');
    }
  },

  updateCookie: async (domain, key, value) => {
    try {
      await invoke('set_cookie', { host: domain, key, value });
      await get().fetchCookies(domain);
    } catch (error) {
      toast.error('Failed to update cookie');
    }
  },

  removeCookie: async (domain, key) => {
    try {
      await invoke('delete_cookie', { host: domain, key });
      await get().fetchCookies(domain);
      toast.success(`Cookie "${key}" removed`);
    } catch (error) {
      toast.error('Failed to remove cookie');
    }
  },

  addDomain: async (domain) => {
    if (!domain) return;
    if (get().domains.includes(domain)) {
      toast.error('Domain already exists');
      return;
    }
    // We add a dummy cookie to "create" the domain in the jar
    try {
      set({ domains: [...get().domains, domain], selectedDomain: domain, currentCookies: {} });
    } catch (error) {
      toast.error('Failed to add domain');
    }
  }
}));
