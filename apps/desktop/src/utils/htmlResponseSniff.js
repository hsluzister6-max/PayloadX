/**
 * Decide when the response body should use the HTML preview (iframe) instead of JSON tooling.
 */

/** @param {string} [ct] */
export function isHtmlContentType(ct) {
  if (!ct || typeof ct !== 'string') return false;
  const base = ct.split(';')[0].trim().toLowerCase();
  return base.includes('html');
}

/**
 * @param {string} text
 */
export function sniffLikelyHtmlText(text) {
  const s = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!s || s.length > 5 * 1024 * 1024) return false;
  return /^<\s*(!DOCTYPE\s+html|html\b|head\b|body\b|div\b|span\b|section\b|article\b|main\b|nav\b|svg\b|table\b|template\b|style\b|script\b|link\b|meta\b)/i.test(
    s,
  );
}

/**
 * @param {string} [contentType]
 * @param {unknown} body
 */
export function shouldTreatBodyAsHtml(contentType, body) {
  if (!body && body !== '') return false;
  const base = typeof contentType === 'string' ? contentType.split(';')[0].trim().toLowerCase() : '';
  if (base.includes('json')) return false;
  if (isHtmlContentType(contentType)) return true;
  return sniffLikelyHtmlText(typeof body === 'string' ? body : '');
}
