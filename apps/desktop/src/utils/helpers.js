/**
 * Format response body with pretty-printing if JSON
 * Handles cross-platform line endings (Windows CRLF, Unix LF, Unicode BOM)
 */
export function formatBody(body, contentType = '') {
  if (!body) return '';
  
  // Normalize the body: handle Windows CRLF, remove BOM, trim
  let normalizedBody = body;
  if (typeof body === 'string') {
    // Remove Unicode BOM (Byte Order Mark) if present
    normalizedBody = body.replace(/^\uFEFF/, '');
    // Normalize Windows CRLF to LF for consistent processing
    normalizedBody = normalizedBody.replace(/\r\n/g, '\n');
    normalizedBody = normalizedBody.replace(/\r/g, '\n');
  }

  if (contentType.includes('application/json') || isJson(normalizedBody)) {
    try {
      // standard single-object JSON parse
      return JSON.stringify(JSON.parse(normalizedBody), null, 2);
    } catch {
      // Fallback: it might be NDJSON (Newline Delimited JSON)
      try {
        const lines = normalizedBody.split('\n').filter(line => line.trim() !== '');
        if (lines.length > 1) {
          const formattedLines = lines.map(line => {
            try {
              return JSON.stringify(JSON.parse(line), null, 2);
            } catch {
              // If individual line isn't valid JSON, return as-is
              return line;
            }
          });
          return formattedLines.join('\n');
        }
      } catch (err) {
        // If it's truly broken JSON, return the normalized unformatted string
        return normalizedBody;
      }
    }
  }
  return normalizedBody;
}

export function isJson(str) {
  if (!str || typeof str !== 'string') return false;
  // Remove BOM and normalize whitespace for detection
  const cleaned = str.replace(/^\uFEFF/, '').trim();
  return (cleaned.startsWith('{') && cleaned.endsWith('}')) ||
         (cleaned.startsWith('[') && cleaned.endsWith(']'));
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
