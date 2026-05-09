import {
  normalizeResponseBodyText,
  parseJsonFamily,
  isJsonFamilyContentType,
  sniffLikelyJsonText,
} from './jsonResponseParse.js';

/**
 * Format response body with pretty-printing for JSON, NDJSON, JSON-seq.
 */
export function formatBody(body, contentType = '') {
  const normalizedBody = normalizeResponseBodyText(body);
  if (!normalizedBody.trim()) return '';

  const parsed = parseJsonFamily(normalizedBody, contentType);
  if (parsed.ok && parsed.value !== null && parsed.value !== undefined) {
    if ((parsed.format === 'ndjson' || parsed.format === 'json-seq') && Array.isArray(parsed.value)) {
      return parsed.value.map((v) => JSON.stringify(v, null, 2)).join('\n');
    }
    return JSON.stringify(parsed.value, null, 2);
  }

  if (parsed.ok && parsed.format === 'empty') return '';

  if (!isJsonFamilyContentType(contentType) && sniffLikelyJsonText(normalizedBody)) {
    try {
      return JSON.stringify(JSON.parse(normalizedBody.trim()), null, 2);
    } catch {
      /* fall through */
    }
  }

  return normalizedBody;
}

export { getResponseContentType, getQuotaExceededHint } from './jsonResponseParse.js';

export function isJson(str) {
  return sniffLikelyJsonText(str);
}

/**
 * Get status class based on HTTP code
 */
export function getStatusClass(status) {
  if (!status) return 'status-badge bg-surface-700 text-tx-secondary';
  if (status >= 200 && status < 300) return 'status-badge status-2xx';
  if (status >= 300 && status < 400) return 'status-badge status-3xx';
  if (status >= 400 && status < 500) return 'status-badge status-4xx';
  if (status >= 500) return 'status-badge status-5xx';
  return 'status-badge bg-surface-700 text-tx-secondary';
}

/**
 * Format bytes to human-readable
 */
export function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format response time to human-readable
 */
export function formatTime(ms) {
  if (!ms && ms !== 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * Get method color class
 */
export function getMethodClass(method) {
  return `method-badge method-${method || 'GET'}`;
}

/**
 * Generate avatar initials
 */
export function getInitials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Truncate long strings
 */
export function truncate(str, max = 40) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

/**
 * Deep clone
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
