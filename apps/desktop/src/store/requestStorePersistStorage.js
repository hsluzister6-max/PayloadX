import { createJSONStorage } from 'zustand/middleware';

/** @param {unknown} err */
function isQuotaError(err) {
  return (
    err?.name === 'QuotaExceededError'
    || err?.code === 22
    || err?.code === 'QUOTA_EXCEEDED_ERR'
    || String(err?.message || '').toLowerCase().includes('quota')
  );
}

/**
 * Emergency shrink of persisted blob when setItem throws (localStorage ~5MB shared).
 * @param {unknown} blob
 */
export function shrinkPersistedRequestBlob(blob) {
  if (!blob || typeof blob !== 'object') return blob;
  const state = blob.state && typeof blob.state === 'object' ? { ...blob.state } : {};
  const stripBody = (res) => {
    if (!res || typeof res !== 'object') return res;
    return { ...res, body: '', headers: {} };
  };
  const truncateRaw = (req) => {
    if (!req || typeof req !== 'object') return req;
    const body = req.body && typeof req.body === 'object' ? { ...req.body } : req.body;
    if (body && typeof body.raw === 'string' && body.raw.length > 2000) {
      body.raw = `${body.raw.slice(0, 2000)}\n… [truncated for storage]`;
    }
    return { ...req, body };
  };

  const history = Array.isArray(state.history) ? state.history.slice(0, 6) : [];
  const openTabs = Array.isArray(state.openTabs)
    ? state.openTabs.slice(0, 8).map((tab) => ({
      ...tab,
      request: truncateRaw(tab.request),
      originalRequest: tab.originalRequest ? truncateRaw(tab.originalRequest) : tab.originalRequest,
      response: stripBody(tab.response),
    }))
    : [];

  return {
    ...blob,
    state: {
      ...state,
      currentRequest: truncateRaw(state.currentRequest),
      history: history.map((h) => ({ ...h, response: stripBody(h.response) })),
      openTabs,
    },
  };
}

/**
 * JSON storage for `useRequestStore` that retries with a minimal blob on quota errors.
 */
export const requestStorePersistStorage = createJSONStorage(() => ({
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch (err) {
      if (!isQuotaError(err)) throw err;
      try {
        const parsed = JSON.parse(value);
        localStorage.setItem(name, JSON.stringify(shrinkPersistedRequestBlob(parsed)));
      } catch {
        try {
          const parsed = JSON.parse(value);
          const nuked = shrinkPersistedRequestBlob(parsed);
          nuked.state = {
            ...nuked.state,
            history: [],
            openTabs: [],
          };
          localStorage.setItem(name, JSON.stringify(nuked));
        } catch {
          try {
            localStorage.removeItem(name);
          } catch {
            /* ignore */
          }
        }
      }
    }
  },
  removeItem: (name) => localStorage.removeItem(name),
}));
