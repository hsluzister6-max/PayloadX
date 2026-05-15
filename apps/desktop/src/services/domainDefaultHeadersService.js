import { tryRequestUrlCookieKey } from './requestUrlKeys';

const STORAGE_KEY = 'payloadx_domain_default_headers_v1';

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/**
 * @returns {Array<{ key: string, value: string }>}
 */
function getListForDomain(domainKey) {
  if (!domainKey) return [];
  const map = readMap();
  const list = map[domainKey];
  return Array.isArray(list) ? list.filter((x) => x && String(x.key ?? '').trim()) : [];
}

/**
 * Headers merged at Send for the resolved request URL (same host/port key as cookie jar).
 * @param {string} resolvedUrl
 * @returns {Array<{ key: string, value: string }>}
 */
export function getDomainDefaultHeaderPairs(resolvedUrl) {
  const key = tryRequestUrlCookieKey(resolvedUrl);
  return getListForDomain(key);
}

/**
 * Saved default headers for a host/port key (same string as cookie jar / merge at Send).
 * @param {string} domainKey
 * @returns {Array<{ key: string, value: string }>}
 */
export function getSavedHeadersForDomainKey(domainKey) {
  return getListForDomain(domainKey);
}

export function saveHeaderForDomain(domainKey, headerKey, headerValue) {
  const k = String(domainKey || '').trim();
  const name = String(headerKey || '').trim();
  if (!k || !name) return;
  const map = readMap();
  const prev = Array.isArray(map[k]) ? [...map[k]] : [];
  const lower = name.toLowerCase();
  const idx = prev.findIndex((h) => String(h.key || '').toLowerCase() === lower);
  const entry = { key: name, value: String(headerValue ?? '') };
  if (idx >= 0) prev[idx] = entry;
  else prev.push(entry);
  map[k] = prev;
  writeMap(map);
}

export function removeHeaderForDomain(domainKey, headerKey) {
  const k = String(domainKey || '').trim();
  const name = String(headerKey || '').trim();
  if (!k || !name) return;
  const map = readMap();
  const prev = Array.isArray(map[k]) ? map[k] : [];
  const lower = name.toLowerCase();
  map[k] = prev.filter((h) => String(h.key || '').toLowerCase() !== lower);
  writeMap(map);
}

export function listAllDomainKeys() {
  return Object.keys(readMap()).sort();
}
