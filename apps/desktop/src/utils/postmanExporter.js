/**
 * Utility to export PayloadX collections to Postman Collection Format v2.1.0
 */

export const exportToPostman = (collection, requests) => {
  const postmanCollection = {
    info: {
      _postman_id: collection._id,
      name: collection.name,
      description: collection.description || '',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [],
  };

  // 1. Group requests by folder
  const folders = collection.folders || [];
  const rootRequests = requests.filter(r => !r.folderId);

  // 2. Add root requests
  postmanCollection.item.push(...rootRequests.map(mapRequestToPostman));

  // 3. Add folders and their requests
  folders.forEach(folder => {
    const folderRequests = requests.filter(r => r.folderId === folder.id);
    postmanCollection.item.push({
      name: folder.name,
      item: folderRequests.map(mapRequestToPostman),
    });
  });

  return postmanCollection;
};

const mapRequestToPostman = (req) => {
  // Parse URL
  let url = req.url || '';
  const urlObj = {
    raw: url,
  };

  try {
    const parsed = new URL(url.startsWith('http') ? url : `http://${url}`);
    urlObj.protocol = parsed.protocol.replace(':', '');
    urlObj.host = parsed.hostname.split('.');
    urlObj.path = parsed.pathname.split('/').filter(p => p);
    // Add query params
    if (parsed.searchParams) {
      urlObj.query = [];
      parsed.searchParams.forEach((value, key) => {
        urlObj.query.push({ key, value });
      });
    }
  } catch (e) {
    // If URL is invalid or contains variables, keep it simple
    urlObj.raw = url;
  }

  // Map Headers
  const headers = (req.headers || []).filter(h => h.key).map(h => ({
    key: h.key,
    value: h.value,
    description: h.description || '',
    disabled: !h.enabled,
  }));

  // Map Body
  let body = {};
  const bodyData = req.body || {};
  if (bodyData.mode === 'raw') {
    body = {
      mode: 'raw',
      raw: bodyData.raw || '',
      options: {
        raw: {
          language: bodyData.rawLanguage || 'json',
        },
      },
    };
  } else if (bodyData.mode === 'form-data') {
    body = {
      mode: 'formdata',
      formdata: (bodyData.formData || []).filter(f => f.key).map(f => ({
        key: f.key,
        value: f.value,
        type: 'text',
        disabled: !f.enabled,
      })),
    };
  } else if (bodyData.mode === 'url-encoded') {
    body = {
      mode: 'urlencoded',
      urlencoded: (bodyData.urlencoded || []).filter(f => f.key).map(f => ({
        key: f.key,
        value: f.value,
        disabled: !f.enabled,
      })),
    };
  }

  // Map Auth
  let auth = null;
  const authData = req.auth || { type: 'none' };
  if (authData.type === 'bearer') {
    auth = {
      type: 'bearer',
      bearer: [{ key: 'token', value: authData.bearer?.token || '', type: 'string' }]
    };
  } else if (authData.type === 'basic') {
    auth = {
      type: 'basic',
      basic: [
        { key: 'username', value: authData.basic?.username || '', type: 'string' },
        { key: 'password', value: authData.basic?.password || '', type: 'string' }
      ]
    };
  }

  return {
    name: req.name || 'Untitled Request',
    request: {
      method: req.method || 'GET',
      header: headers,
      body: Object.keys(body).length > 0 ? body : undefined,
      auth: auth || undefined,
      url: urlObj,
      description: req.description || '',
    },
    response: [],
  };
};
