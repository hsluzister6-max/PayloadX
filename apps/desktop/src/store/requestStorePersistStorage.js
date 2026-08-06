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

/** Avoid writing localStorage on every keystroke in the body editor (freezes WebView). */
const PERSIST_DEBOUNCE_MS = 400;
const pendingPersist = new Map();

function writePersistItem(name, value) {
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
}

/**
 * JSON storage for `useRequestStore` that retries with a minimal blob on quota errors.
 * setItem is debounced so typing/pasting in request body does not freeze the app.
 */
export const requestStorePersistStorage = createJSONStorage(() => ({
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => {
    const prev = pendingPersist.get(name);
    if (prev?.timer) clearTimeout(prev.timer);
    const timer = setTimeout(() => {
      pendingPersist.delete(name);
      writePersistItem(name, value);
    }, PERSIST_DEBOUNCE_MS);
    pendingPersist.set(name, { timer, value });
  },
  removeItem: (name) => {
    const prev = pendingPersist.get(name);
    if (prev?.timer) clearTimeout(prev.timer);
    pendingPersist.delete(name);
    localStorage.removeItem(name);
  },
}));

/** Flush pending request-store persist (call before Send / Save / unload). */
export function flushRequestStorePersist() {
  for (const [name, entry] of pendingPersist.entries()) {
    if (entry?.timer) clearTimeout(entry.timer);
    pendingPersist.delete(name);
    if (entry?.value != null) writePersistItem(name, entry.value);
  }
}
