import { isTauriRuntime } from '@/lib/runtime';
import { localStorageService } from '@/services/localStorageService';
import { toast } from '@/store/toastStore';

const MAIN_REQUEST_STORE_NAME = 'syncnest-request';
const BROWSER_LABEL_KEY = 'payloadx_workspace_label';

function readInjectedWorkspace() {
  if (typeof window === 'undefined') return null;
  return window.__PAYLOADX_WORKSPACE__ || null;
}

function readTauriWindowLabel() {
  if (typeof window === 'undefined') return null;
  return window.__TAURI_METADATA__?.__currentWindow?.label || null;
}

function readBrowserWindowLabel() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('sessionWindow')) return null;
    let id = sessionStorage.getItem(BROWSER_LABEL_KEY);
    if (!id) {
      id = `browser-${Date.now()}`;
      sessionStorage.setItem(BROWSER_LABEL_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function getWorkspaceLabel() {
  return readInjectedWorkspace()?.label || readTauriWindowLabel() || readBrowserWindowLabel() || 'main';
}

export function isMainWorkspaceWindow() {
  return getWorkspaceLabel() === 'main';
}

export function getWorkspaceSessionNumber() {
  const label = getWorkspaceLabel();
  if (label === 'main') return 1;
  const match = /^workspace-(\d+)$/.exec(label);
  if (match) return Number(match[1]);
  const injected = readInjectedWorkspace()?.sessionName;
  const fromName = /^Session\s+(\d+)$/.exec(injected || '');
  if (fromName) return Number(fromName[1]);
  return null;
}

export function getWorkspaceSessionName() {
  const injected = readInjectedWorkspace()?.sessionName;
  if (injected) return injected;
  const n = getWorkspaceSessionNumber();
  return n ? `Session ${n}` : 'Session';
}

export function getRequestStorePersistName() {
  const label = getWorkspaceLabel();
  return label === 'main' ? MAIN_REQUEST_STORE_NAME : `${MAIN_REQUEST_STORE_NAME}:${label}`;
}

export function consumeOpenRequestId() {
  const injected = readInjectedWorkspace()?.openRequestId;
  if (injected) return String(injected);
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get('openRequest');
  } catch {
    return null;
  }
}

export function findLocalRequestById(requestId) {
  if (!requestId) return null;
  try {
    const all = localStorageService.get(localStorageService.KEYS.REQUESTS) || {};
    for (const list of Object.values(all)) {
      const found = (list || []).find((req) => String(req?._id) === String(requestId));
      if (found) return found;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function openWorkspaceWindow({ requestId } = {}) {
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/tauri');
    try {
      const created = await invoke('create_workspace_window', {
        openRequestId: requestId || null,
      });
      toast.success(`${created?.sessionName || 'New window'} opened with its own API session`);
      return created;
    } catch (err) {
      const message = String(err?.message || err || '');
      if (message.includes('NEW_WINDOW_BUSY')) return null;
      throw err;
    }
  }

  const url = new URL(window.location.href);
  url.searchParams.set('sessionWindow', '1');
  if (requestId) url.searchParams.set('openRequest', requestId);
  else url.searchParams.delete('openRequest');
  const opened = window.open(url.toString(), '_blank', 'noopener,noreferrer');
  if (!opened) {
    throw new Error('Pop-up blocked. Allow pop-ups to open a new window.');
  }
  toast.success('New window opened with its own API session');
  return { label: 'browser', sessionName: 'Session' };
}

export function installWorkspaceWindowCleanup() {
  if (typeof window === 'undefined') return;
  const persistName = getRequestStorePersistName();
  if (persistName === MAIN_REQUEST_STORE_NAME) return;
  const remove = () => {
    try {
      localStorage.removeItem(persistName);
    } catch {
      /* ignore */
    }
  };
  window.addEventListener('beforeunload', remove);
}
