/**
 * Helpers for multipart/form-data builder UI (text rows + file attachments).
 */

/** @typedef {{ key: string, value?: string, enabled?: boolean, type?: 'text'|'file', fileName?: string, mimeType?: string, base64?: string }} FormDataRow */

/**
 * Parse pasted bulk lines into text fields.
 * Supports `key: value`, `key=value`, optional `#` comments; trims quoted values.
 * @param {string} text
 * @returns {FormDataRow[]}
 */
export function parseBulkFormDataLines(text) {
  const rows = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    const co = line.indexOf(':');
    let sep = -1;
    if (eq >= 0 && (co < 0 || eq < co)) sep = eq;
    else if (co >= 0) sep = co;
    if (sep <= 0) continue;

    const key = line.slice(0, sep).trim();
    let value = line.slice(sep + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    }
    if (!key) continue;

    rows.push({ key, value, enabled: true, type: 'text' });
  }
  return rows;
}

/** @param {ArrayBuffer} buffer */
export function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function formatFileSize(n) {
  if (n == null || Number.isNaN(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}
