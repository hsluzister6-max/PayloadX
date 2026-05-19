/**
 * Off-main-thread HTML normalization for large bodies (DOMParser can be expensive).
 */
import { normalizeHtmlForPreview } from '../utils/htmlNormalize.js';

self.onmessage = (e) => {
  const { id, html } = e.data;
  try {
    const out = normalizeHtmlForPreview(html);
    self.postMessage({ id, ok: true, html: out });
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
