/**
 * JsonWorker.js — Off-main-thread JSON parser
 *
 * Protocol:
 *   IN  { type: 'PARSE', id: number, raw: string }
 *   OUT { type: 'RESULT', id, parsed: any, parseMs: number }
 *       { type: 'ERROR',  id, message: string, parseMs: number }
 *
 * Never posts back stale results — the caller can ignore mismatched ids,
 * but we also self-terminate after each parse.
 */

self.onmessage = ({ data }) => {
  if (data?.type !== 'PARSE') return;

  const { id, raw } = data;
  const t0 = performance.now();

  try {
    // Strip BOM and surrounding whitespace
    const cleaned = typeof raw === 'string'
      ? raw.replace(/^\uFEFF/, '').trim()
      : '';

    if (!cleaned) {
      self.postMessage({ type: 'ERROR', id, message: 'Empty input', parseMs: 0 });
      return;
    }

    let parsed;

    // ── Primary: standard JSON.parse ──────────────────────────────────────
    try {
      parsed = JSON.parse(cleaned);
    } catch (primaryErr) {
      // ── Fallback: NDJSON (newline-delimited JSON) ──────────────────────
      const lines = cleaned.split('\n').filter(l => l.trim());
      if (lines.length > 1) {
        try {
          parsed = lines.map(l => JSON.parse(l));
        } catch (_) {
          // Re-throw original error so error message reflects the first attempt
          throw primaryErr;
        }
      } else {
        throw primaryErr;
      }
    }

    const parseMs = performance.now() - t0;
    self.postMessage({ type: 'RESULT', id, parsed, parseMs });

  } catch (err) {
    const parseMs = performance.now() - t0;
    self.postMessage({ type: 'ERROR', id, message: err.message, parseMs });
  }
};
