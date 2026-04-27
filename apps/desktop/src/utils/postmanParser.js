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
  const items = json.item || [];

  const collectionMeta = {
    name: info.name || 'Imported Collection',
    description: info.description || '',
    version: info.version || '1.0.0',
  };

  const { requests, folders } = parseItems(items);

  return { collectionMeta, requests, folders };
}

function parseItems(items, parentFolderId = null) {
  const requests = [];
  const folders = [];

  for (const item of items) {
    if (item.item) {
      // It's a folder
      const folderId = crypto.randomUUID();
      const folderRequests = [];
      const subResult = parseItems(item.item, folderId);

      for (const req of subResult.requests) {
        folderRequests.push(req);
        requests.push({ ...req, folderId });
      }

      folders.push({
        id: folderId,
        name: item.name || 'Untitled Folder',
        requestIds: folderRequests.map((_, i) => i), // Will be replaced with real IDs after DB save
        description: item.description || '',
      });

      // Recurse nested folders
      folders.push(...subResult.folders);
    } else {
      requests.push(parseRequest(item, parentFolderId));
    }
  }

  return { requests, folders };
}

function parseRequest(item, folderId = null) {
  const r = item.request || {};
  const url = extractUrl(r.url);
  const params = extractParams(r.url);

  return {
    name: item.name || 'Untitled Request',
    method: (r.method || 'GET').toUpperCase(),
    url,
    params,
    headers: parseHeaders(r.header),
    body: parseBody(r.body),
    auth: parseAuth(r.auth),
    description: extractDescription(r.description),
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
