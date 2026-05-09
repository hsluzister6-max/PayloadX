/**
 * Run {@link parseJsonFamily} in a Web Worker so huge responses do not freeze the UI.
 */
const PENDING = new Map();
let nextId = 1;
let workerInst = null;

function getWorker() {
  if (workerInst) return workerInst;
  workerInst = new Worker(new URL('../workers/responseParse.worker.js', import.meta.url), {
    type: 'module',
  });
  workerInst.onmessage = (e) => {
    const { id, ok, ...rest } = e.data;
    const entry = PENDING.get(id);
    if (!entry) return;
    PENDING.delete(id);
    if (ok) entry.resolve(rest);
    else entry.reject(new Error(rest.error || 'Parse failed'));
  };
  workerInst.onerror = (ev) => {
    const msg = ev.message || 'Worker failed';
    workerInst.terminate();
    workerInst = null;
    for (const [, entry] of PENDING) entry.reject(new Error(msg));
    PENDING.clear();
  };
  return workerInst;
}

/**
 * @param {string} text
 * @param {string} contentType
 * @param {number} [timeoutMs]
 * @returns {Promise<{ format: string, displayMode: 'tree'|'prettyText', value?: unknown, prettyText?: string }>}
 */
export function parseResponseInWorker(text, contentType, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const t = setTimeout(() => {
      if (PENDING.delete(id)) {
        reject(new Error('Response parse timed out'));
      }
    }, timeoutMs);
    PENDING.set(id, {
      resolve: (v) => {
        clearTimeout(t);
        resolve(v);
      },
      reject: (err) => {
        clearTimeout(t);
        reject(err);
      },
    });
    try {
      getWorker().postMessage({ id, text, contentType: contentType || '' });
    } catch (e) {
      PENDING.delete(id);
      clearTimeout(t);
      reject(e);
    }
  });
}

/** Use worker when string is large enough that main-thread JSON.parse would jank. */
export const RESPONSE_PARSE_WORKER_MIN_CHARS = 24 * 1024;

export function shouldParseResponseInWorker(text) {
  return typeof text === 'string' && text.length >= RESPONSE_PARSE_WORKER_MIN_CHARS;
}
