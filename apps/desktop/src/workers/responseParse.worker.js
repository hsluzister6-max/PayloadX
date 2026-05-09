/**
 * Off-main-thread parse for large JSON / NDJSON / JSON-seq bodies (Vite worker module).
 *
 * Above ~400k chars we do not ship the parsed object back to the main thread: building the
 * tree (buildLines) allocates one UI row per scalar and can exhaust memory in production.
 * Instead we return pretty-printed text for virtualized line rendering.
 */
import { parseJsonFamily } from '../utils/jsonResponseParse.js';

/** Input size above which structured clone + tree flatten is skipped (Pretty = virtualized text). */
const MAX_TREE_INPUT_CHARS = 400_000;

function prettyFromValue(format, value) {
  if (format === 'ndjson' || format === 'json-seq') {
    if (Array.isArray(value)) {
      return value.map((v) => JSON.stringify(v, null, 2)).join('\n');
    }
  }
  return JSON.stringify(value, null, 2);
}

self.onmessage = (e) => {
  const { id, text, contentType } = e.data;
  try {
    const result = parseJsonFamily(text, contentType || '');
    if (!result.ok) {
      self.postMessage({ id, ok: false, error: result.error });
      return;
    }
    if (result.format === 'empty') {
      self.postMessage({
        id,
        ok: true,
        format: result.format,
        displayMode: 'tree',
        value: null,
      });
      return;
    }

    const isStreamFormat = result.format === 'ndjson' || result.format === 'json-seq';
    if (isStreamFormat && Array.isArray(result.value)) {
      let arr = result.value;
      let ndjsonTruncated = null;
      const MAX_NDJSON_RECORDS = 20_000;
      if (arr.length > MAX_NDJSON_RECORDS) {
        ndjsonTruncated = { total: arr.length, shown: MAX_NDJSON_RECORDS };
        arr = arr.slice(0, MAX_NDJSON_RECORDS);
      }
      self.postMessage({
        id,
        ok: true,
        format: result.format,
        displayMode: 'tree',
        value: arr,
        ndjsonTruncated,
      });
      return;
    }

    const large = typeof text === 'string' && text.length >= MAX_TREE_INPUT_CHARS;
    if (large) {
      let prettyText;
      try {
        prettyText = prettyFromValue(result.format, result.value);
      } catch (err) {
        self.postMessage({
          id,
          ok: false,
          error: err?.message || String(err),
        });
        return;
      }
      const MAX_PRETTY_CHARS = 15_000_000;
      if (prettyText.length > MAX_PRETTY_CHARS) {
        prettyText = `${prettyText.slice(0, MAX_PRETTY_CHARS)}\n… [truncated for display — use Download for full body]`;
      }
      self.postMessage({
        id,
        ok: true,
        format: result.format,
        displayMode: 'prettyText',
        prettyText,
      });
      return;
    }

    self.postMessage({
      id,
      ok: true,
      format: result.format,
      displayMode: 'tree',
      value: result.value,
    });
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err?.message || String(err),
    });
  }
};
