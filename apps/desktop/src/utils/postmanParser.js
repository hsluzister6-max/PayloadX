/**
 * Postman Collection v2 / v2.1 parser for client-side use
 * Converts Postman JSON to PayloadX internal request schema
 *
 * Rust-first: delegates to the native serde_json parser for large collections.
 * Falls back to the JS implementation automatically.
 */

/**
 * Primary entry point — tries Rust parser, falls back to JS.
 * Use this instead of parsePostmanCollection() directly.
 *
 * @param {string|object} input — JSON string or already-parsed object
 * @returns {Promise<object>}
 */
export async function parsePostmanCollectionAuto(input) {
  const json = typeof input === 'string' ? input : JSON.stringify(input);
  const { rustParsePostman } = await import('@/lib/rust');
  return rustParsePostman(json);
}

export function parsePostmanCollection(json) {
  const info = json.info || {};
  const items = json.item || json.items || []; // Support 'items' just in case

  const collectionMeta = {
    name: info.name || 'Imported Collection',
    description: info.description || '',
    version: info.version || '1.0.0',
  };

  const { requests, folders } = parseItems(items);

  return { collectionMeta, requests, folders };
}

function parseItems(items, parentId = null) {
  const requests = [];
  const folders = [];

  if (!Array.isArray(items)) return { requests, folders };

  for (const item of items) {
    if (!item) continue;

    // Use Postman's native ID if available, otherwise generate one
    const nativeId = item.id || item._postman_id || crypto.randomUUID();

    if (item.item && Array.isArray(item.item)) {
      // It's a folder
      const subResult = parseItems(item.item, nativeId);

      folders.push({
        id: nativeId,
        name: item.name || 'Untitled Folder',
        description: item.description || '',
        parentId: parentId,
      });

      requests.push(...subResult.requests);
      folders.push(...subResult.folders);
    } else if (item.request) {
      // It's a request
      requests.push(parseRequest(item, parentId));
    }
  }

  return { requests, folders };
}

function parseRequest(item, folderId = null) {
  const r = item.request || {};
  
  // Handle case where 'request' is just a URL string
  const isStringRequest = typeof r === 'string';
  const method = isStringRequest ? 'GET' : (r.method || 'GET').toUpperCase();
  const rawUrl = isStringRequest ? r : (r.url?.raw || (typeof r.url === 'string' ? r.url : ''));
  
  const url = extractUrl(isStringRequest ? { raw: r } : r.url);
  const params = extractParams(isStringRequest ? null : r.url);

  return {
    id: item.id || item._postman_id || crypto.randomUUID(),
    name: item.name || 'Untitled Request',
    method,
    url,
    params,
    headers: parseHeaders(isStringRequest ? [] : r.header),
    body: parseBody(isStringRequest ? null : r.body),
    auth: parseAuth(isStringRequest ? null : r.auth),
    description: extractDescription(isStringRequest ? '' : r.description),
    folderId,
  };
}

function extractUrl(url) {
  if (!url) return '';
  if (typeof url === 'string') return url;
  return url.raw || url.host?.join('.') || '';
}

function extractParams(url) {
  if (!url || typeof url === 'string') return [];
  return (url.query || []).map((q) => ({
    key: q.key || '',
    value: q.value || '',
    description: q.description || '',
    enabled: !q.disabled,
  }));
}

function parseHeaders(headers = []) {
  return headers.map((h) => ({
    key: h.key || '',
    value: h.value || '',
    description: h.description || '',
    enabled: !h.disabled,
  }));
}

function parseBody(body) {
  if (!body) return { mode: 'none', raw: '', rawLanguage: 'json' };

  switch (body.mode) {
    case 'raw':
      return {
        mode: 'raw',
        raw: body.raw || '',
        rawLanguage: body.options?.raw?.language || 'json',
      };
    case 'formdata':
      return {
        mode: 'form-data',
        formData: (body.formdata || []).map((f) => ({
          key: f.key || '',
          value: f.value || '',
          enabled: !f.disabled,
        })),
        raw: '',
        rawLanguage: 'json',
      };
    case 'urlencoded':
      return {
        mode: 'urlencoded',
        urlencoded: (body.urlencoded || []).map((u) => ({
          key: u.key || '',
          value: u.value || '',
          enabled: !u.disabled,
        })),
        raw: '',
        rawLanguage: 'json',
      };
    default:
      return { mode: 'none', raw: '', rawLanguage: 'json' };
  }
}

function parseAuth(auth) {
  if (!auth || auth.type === 'noauth') return { type: 'none' };

  switch (auth.type) {
    case 'bearer': {
      const token = findAuthValue(auth.bearer, 'token');
      return { type: 'bearer', bearer: { token } };
    }
    case 'basic': {
      const username = findAuthValue(auth.basic, 'username');
      const password = findAuthValue(auth.basic, 'password');
      return { type: 'basic', basic: { username, password } };
    }
    case 'apikey': {
      const key = findAuthValue(auth.apikey, 'key');
      const value = findAuthValue(auth.apikey, 'value');
      const location = findAuthValue(auth.apikey, 'in') || 'header';
      return { type: 'apikey', apikey: { key, value, in: location } };
    }
    default:
      return { type: 'none' };
  }
}

function findAuthValue(arr = [], key) {
  const item = arr.find((i) => i.key === key);
  return item?.value || '';
}

function extractDescription(desc) {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  return desc.content || '';
}
