/**
 * Off-main-thread JSON tree flattening (standard JSON, NDJSON, JSON-seq).
 * Keeps the UI thread responsive on Windows / macOS / Linux (Tauri + browsers).
 */
import { buildLines, buildNdjsonTreeLines } from '../utils/jsonTreeLines.js';

self.onmessage = (e) => {
  const { id, format, value, collapsed: collapsedArr } = e.data;
  const collapsed = new Set(Array.isArray(collapsedArr) ? collapsedArr : []);
  try {
    const stream = (format === 'ndjson' || format === 'json-seq') && Array.isArray(value);
    const lines = stream
      ? buildNdjsonTreeLines(value, collapsed)
      : buildLines(value, 'root', 0, false, collapsed);
    self.postMessage({ id, ok: true, lines });
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err?.message || String(err),
    });
  }
};
