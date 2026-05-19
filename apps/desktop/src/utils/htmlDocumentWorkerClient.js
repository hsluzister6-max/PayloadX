/**
 * Run {@link normalizeHtmlForPreview} in a Web Worker for large HTML payloads.
 */
import { normalizeHtmlForPreview } from './htmlNormalize.js';

const PENDING = new Map();
let nextId = 1;
let workerInst = null;

/** Above this size, normalization runs off the main thread. */
export const HTML_NORMALIZE_WORKER_MIN_CHARS = 48 * 1024;

function getWorker() {
  if (workerInst) return workerInst;
  workerInst = new Worker(new URL('../workers/htmlDocument.worker.js', import.meta.url), {
    type: 'module',
  });
  workerInst.onmessage = (ev) => {
    const { id, ok, html, error } = ev.data;
    const entry = PENDING.get(id);
    if (!entry) return;
    PENDING.delete(id);
    if (ok) entry.resolve(html);
    else entry.reject(new Error(error || 'HTML normalize failed'));
  };
  workerInst.onerror = (ev) => {
    const msg = ev.message || 'HTML worker failed';
    if (workerInst) workerInst.terminate();
    workerInst = null;
    for (const [, entry] of PENDING) entry.reject(new Error(msg));
    PENDING.clear();
  };
  return workerInst;
}

/**
 * @param {string} html
 * @param {number} [timeoutMs]
 * @returns {Promise<string>}
 */
export function normalizeHtmlInWorker(html, timeoutMs = 90_000) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const t = setTimeout(() => {
      if (PENDING.delete(id)) reject(new Error('HTML normalize timed out'));
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
      getWorker().postMessage({ id, html });
    } catch (e) {
      PENDING.delete(id);
      clearTimeout(t);
      reject(e);
    }
  });
}

/**
 * @param {string} html
 * @returns {Promise<string>}
 */
export async function normalizeHtmlAdaptive(html) {
  const s = typeof html === 'string' ? html : String(html ?? '');
  if (s.length < HTML_NORMALIZE_WORKER_MIN_CHARS) {
    return normalizeHtmlForPreview(s);
  }
  try {
    return await normalizeHtmlInWorker(s);
  } catch {
    return normalizeHtmlForPreview(s);
  }
}
