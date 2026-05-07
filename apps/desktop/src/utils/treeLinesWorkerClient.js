/**
 * Build virtual rows for {@link JsonTreeViewer} in a Web Worker (module worker, Vite-friendly).
 */
const PENDING = new Map();
let nextId = 1;
let workerInst = null;

function getWorker() {
  if (workerInst) return workerInst;
  workerInst = new Worker(new URL('../workers/jsonTreeLines.worker.js', import.meta.url), {
    type: 'module',
  });
  workerInst.onmessage = (e) => {
    const { id, ok, lines, error } = e.data;
    const entry = PENDING.get(id);
    if (!entry) return;
    PENDING.delete(id);
    if (ok) entry.resolve(lines);
    else entry.reject(new Error(error || 'Tree build failed'));
  };
  workerInst.onerror = (ev) => {
    const msg = ev.message || 'Tree worker failed';
    workerInst.terminate();
    workerInst = null;
    for (const [, entry] of PENDING) entry.reject(new Error(msg));
    PENDING.clear();
  };
  return workerInst;
}

/** Below this serialized size we build on the main thread (worker scheduling + clone not worth it). */
export const TREE_LINES_SYNC_MAX_BYTES = 40 * 1024;

/** NDJSON / JSON-seq: use worker when this many records (row layout dominates). */
export const TREE_LINES_SYNC_MAX_ARRAY_ITEMS = 500;

/**
 * @param {unknown} value
 * @param {string} format result.format from parseJsonFamily / parse worker
 * @param {string[]} collapsedPaths sorted or arbitrary array of collapsed paths
 * @param {number} [timeoutMs]
 * @returns {Promise<unknown[]>} line descriptors for Row / VirtualScroller
 */
export function buildTreeLinesInWorker(value, format, collapsedPaths, timeoutMs = 90_000) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const t = setTimeout(() => {
      if (PENDING.delete(id)) {
        reject(new Error('Tree layout timed out'));
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
      getWorker().postMessage({
        id,
        format: format || '',
        value,
        collapsed: collapsedPaths || [],
      });
    } catch (e) {
      PENDING.delete(id);
      clearTimeout(t);
      reject(e);
    }
  });
}

/**
 * @param {unknown} value
 * @param {string} [format]
 */
export function shouldUseTreeLinesWorker(value, format) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) {
    const stream = format === 'ndjson' || format === 'json-seq';
    if (stream && value.length >= TREE_LINES_SYNC_MAX_ARRAY_ITEMS) return true;
    if (value.length >= 2_500) return true;
  }
  try {
    return JSON.stringify(value).length >= TREE_LINES_SYNC_MAX_BYTES;
  } catch {
    return true;
  }
}
