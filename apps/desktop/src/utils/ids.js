/** Stable string id from Mongo ObjectId, populated ref, or primitive. */
export function idStr(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    if (value._id != null && value._id !== value) return idStr(value._id);
    if (value.id != null && value.id !== value) return idStr(value.id);
    if (value.$oid != null) return String(value.$oid);
    if (typeof value.toHexString === 'function') return value.toHexString();
  }
  return String(value);
}

export function idsEqual(a, b) {
  const left = idStr(a);
  const right = idStr(b);
  return left !== '' && left === right;
}

export function requestKey(request) {
  return idStr(request?._id || request?.id);
}

export function folderKey(folder) {
  return idStr(folder?.id || folder?._id);
}

/** Keep first occurrence of each id. Items without an id are kept. */
export function dedupeById(items, field = '_id') {
  if (!Array.isArray(items) || items.length === 0) return items || [];
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = field === '_id'
      ? requestKey(item)
      : idStr(item?.[field] ?? item?.id ?? item?._id);
    if (!key) {
      out.push(item);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function rebuildRequestIndex(requests) {
  const map = new Map();
  for (const request of requests || []) {
    const key = requestKey(request);
    if (key) map.set(key, request);
  }
  return map;
}

/** Replace one collection's requests, then drop any leftover duplicate ids. */
export function mergeRequestsForCollection(existing, collectionId, incoming) {
  const cid = idStr(collectionId);
  const others = (existing || []).filter((request) => idStr(request.collectionId) !== cid);
  return dedupeById([...others, ...(incoming || [])]);
}

export function filterRequestsForCollection(requests, collectionId) {
  const cid = idStr(collectionId);
  const seen = new Set();
  const out = [];
  for (const request of requests || []) {
    if (idStr(request.collectionId) !== cid) continue;
    const key = requestKey(request);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(request);
  }
  return out;
}
