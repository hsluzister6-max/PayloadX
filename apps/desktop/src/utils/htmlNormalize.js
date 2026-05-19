/**
 * Turn arbitrary HTML / fragments into a document suitable for iframe srcDoc preview.
 * Uses DOMParser when available so browsers repair incomplete markup similarly to a tab load.
 */

const EMPTY_DOC =
  '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>';

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeHtmlForPreview(raw) {
  if (raw == null) return EMPTY_DOC;
  const s = String(raw)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!s) return EMPTY_DOC;

  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(s, 'text/html');
      const root = doc.documentElement;
      if (root && root.tagName && root.tagName.toLowerCase() === 'html') {
        const serialized = root.outerHTML;
        const hasDoctype = /^\s*<!DOCTYPE/i.test(s);
        return hasDoctype ? serialized : `<!DOCTYPE html>\n${serialized}`;
      }
    } catch {
      /* fall through */
    }
  }

  const probe = s.slice(0, 1200).toLowerCase();
  if (probe.includes('<html') || probe.includes('<!doctype')) {
    if (/<head[^>]*>/i.test(s) && !/<meta[^>]+charset/i.test(s)) {
      return s.replace(/<head([^>]*)>/i, '<head$1><meta charset="utf-8">');
    }
    return s;
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${s}</body></html>`;
}
