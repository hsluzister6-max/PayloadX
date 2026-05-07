/**
 * JSON / NDJSON / JSON-seq parsing for API responses (main thread + Web Worker).
 */

/**
 * @param {unknown} body
 * @returns {string}
 */
export function normalizeResponseBodyText(body) {
  if (body == null) return '';
  if (typeof body !== 'string') {
    try {
      return JSON.stringify(body);
    } catch {
      return String(body);
    }
  }
  return body.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** @param {string} [ct] */
function contentTypeBase(ct) {
  if (!ct || typeof ct !== 'string') return '';
  return ct.split(';')[0].trim().toLowerCase();
}

export function isNdjsonLineContentType(ct) {
  const s = contentTypeBase(ct);
  return (
    s.includes('ndjson')
    || s.includes('jsonl')
    || s.includes('json-lines')
    || s.endsWith('/jsonl')
    || s.includes('x-json-stream')
    || s === 'application/jsonlines'
  );
}

export function isJsonSeqContentType(ct) {
  const s = contentTypeBase(ct);
  return s.includes('json-seq') || s.includes('jsonsequence') || s === 'application/x-json-seq';
}

export function isJsonFamilyContentType(ct) {
  const s = contentTypeBase(ct);
  return Boolean(s && s.includes('json'));
}

function parseLineRecords(lines) {
  return lines.map((line) => {
    const s = line.startsWith('\u001e') ? line.slice(1).trim() : line;
    return JSON.parse(s);
  });
}

/**
 * @param {string} text
 * @param {string} [contentType]
 * @returns {{ ok: true, value: unknown, format: 'json'|'ndjson'|'json-seq'|'empty' } | { ok: false, error: string }}
 */
export function parseJsonFamily(text, contentType = '') {
  const cleaned = normalizeResponseBodyText(text).trim();
  if (!cleaned) {
    return { ok: true, value: null, format: 'empty' };
  }

  const tryWhole = () => {
    try {
      return { ok: true, value: JSON.parse(cleaned), format: 'json' };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  const linesNonEmpty = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const tryNdjsonFromLines = (lines, forceManyLines) => {
    if (lines.length === 0) return null;
    if (lines.length === 1 && !forceManyLines) return null;
    try {
      const records = parseLineRecords(lines);
      if (records.length === 1) {
        return { ok: true, value: records[0], format: 'json' };
      }
      return { ok: true, value: records, format: 'ndjson' };
    } catch {
      return null;
    }
  };

  const tryJsonSeqRs = () => {
    if (!cleaned.includes('\u001e')) return null;
    const chunks = cleaned
      .split('\u001e')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (chunks.length === 0) return null;
    try {
      const records = chunks.map((c) => JSON.parse(c));
      if (records.length === 1) {
        return { ok: true, value: records[0], format: 'json' };
      }
      return { ok: true, value: records, format: 'json-seq' };
    } catch {
      return null;
    }
  };

  if (isJsonSeqContentType(contentType)) {
    const rs = tryJsonSeqRs();
    if (rs) return rs;
    const fromLines = tryNdjsonFromLines(linesNonEmpty, true);
    if (fromLines) return fromLines;
    const whole = tryWhole();
    if (whole.ok) return whole;
    return { ok: false, error: whole.error || 'Invalid JSON-seq' };
  }

  if (isNdjsonLineContentType(contentType)) {
    if (linesNonEmpty.length === 0) {
      return { ok: true, value: null, format: 'empty' };
    }
    try {
      const records = parseLineRecords(linesNonEmpty);
      if (records.length === 1) {
        return { ok: true, value: records[0], format: 'json' };
      }
      return { ok: true, value: records, format: 'ndjson' };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  const whole = tryWhole();
  if (whole.ok) return whole;

  const rs = tryJsonSeqRs();
  if (rs) return rs;

  const nd = tryNdjsonFromLines(linesNonEmpty, false);
  if (nd) return nd;

  if (linesNonEmpty.length === 1) {
    try {
      return { ok: true, value: JSON.parse(linesNonEmpty[0]), format: 'json' };
    } catch {
      /* ignore */
    }
  }

  return { ok: false, error: whole.error || 'Invalid JSON' };
}

/**
 * @param {Record<string, string> | null | undefined} headers
 */
export function getResponseContentType(headers) {
  if (!headers || typeof headers !== 'object') return '';
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === 'content-type') return String(v ?? '');
  }
  return '';
}

export function sniffLikelyJsonText(str) {
  if (!str || typeof str !== 'string') return false;
  const cleaned = str.replace(/^\uFEFF/, '').trim();
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  return (
    (first === '{' && last === '}')
    || (first === '[' && last === ']')
    || first === '"'
    || /^-?\d/.test(cleaned)
    || cleaned === 'true'
    || cleaned === 'false'
    || cleaned === 'null'
  );
}

/** Friendly hint when tunnels / APIs return plain-text quota errors */
export function getQuotaExceededHint(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.toLowerCase();
  if (!t.includes('quota')) return null;
  return (
    'This message almost always comes from a bandwidth, request, or plan cap '
    + '(typical for free ngrok tunnels, hosted APIs, or CDNs)—not from the JSON viewer. '
    + 'Upgrade the tunnel/API tier, wait for the limit window to reset, or hit the server directly without the tunnel.'
  );
}
