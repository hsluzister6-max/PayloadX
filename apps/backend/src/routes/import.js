/**
 * Import Routes
 * POST /api/import - Import Postman collection
 */

import express from 'express';
import Collection from '../../models/Collection.js';
import Request from '../../models/Request.js';
import { authenticate } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * Postman Collection v2.1 → SyncNest internal schema converter
 */
function parsePostmanItem(item, collectionId, projectId, teamId, parentId = null) {
  const requests = [];
  const folders = [];

  if (!item) return { requests, folders };

  const nativeId = item.id || item._postman_id || uuidv4();

  if (item.item && Array.isArray(item.item)) {
    // It's a folder
    const folderRequestIds = [];

    folders.push({ 
      id: nativeId, 
      name: item.name || 'Untitled Folder', 
      parentId: parentId, 
      requestIds: folderRequestIds 
    });

    item.item.forEach((subItem) => {
      const { requests: subRequests, folders: subFolders } = parsePostmanItem(
        subItem, 
        collectionId, 
        projectId, 
        teamId, 
        nativeId
      );
      requests.push(...subRequests);
      folders.push(...subFolders);
      
      if (subItem && !subItem.item && subItem.request) {
        // Direct request
        folderRequestIds.push(subRequests[0]?._id || uuidv4());
      }
    });
  } else if (item.request) {
    // It's a request
    requests.push(buildRequest(item, collectionId, projectId, teamId, parentId));
  }

  return { requests, folders };
}

function buildRequest(item, collectionId, projectId, teamId, folderId) {
  const r = item.request || {};

  // Extract URL — handle both string and Postman URL object forms
  let url = '';
  if (typeof r.url === 'string') {
    url = r.url;
  } else if (r.url && typeof r.url === 'object') {
    url = r.url.raw || (r.url.host ? r.url.host.join('.') : '') || '';
  }

  const headers = (r.header || []).map((h) => ({
    key: h.key,
    value: h.value,
    description: h.description || '',
    enabled: !h.disabled,
  }));

  const params = (r.url?.query || []).map((q) => ({
    key: q.key,
    value: q.value || '',
    description: q.description || '',
    enabled: !q.disabled,
  }));

  let body = { mode: 'none', raw: '', rawLanguage: 'json' };
  if (r.body) {
    if (r.body.mode === 'raw') {
      // Normalize rawLanguage to allowed enum values
      const rawLang = (r.body.options?.raw?.language || 'text').toLowerCase();
      const ALLOWED_LANGS = ['json', 'text', 'xml', 'html', 'javascript'];
      const rawLanguage = ALLOWED_LANGS.includes(rawLang) ? rawLang : 'text';
      body = { mode: 'raw', raw: r.body.raw || '', rawLanguage };
    } else if (r.body.mode === 'formdata') {
      body = {
        mode: 'form-data',
        raw: '',
        rawLanguage: 'json',
        formData: (r.body.formdata || []).map((f) => ({
          key: f.key || '',
          value: f.value || '',
          enabled: !f.disabled,
        })),
      };
    } else if (r.body.mode === 'urlencoded') {
      body = {
        mode: 'urlencoded',
        raw: '',
        rawLanguage: 'json',
        urlencoded: (r.body.urlencoded || []).map((u) => ({
          key: u.key || '',
          value: u.value || '',
          enabled: !u.disabled,
        })),
      };
    }
  }

  let auth = { type: 'none' };
  if (r.auth) {
    if (r.auth.type === 'bearer') {
      const token = (r.auth.bearer || []).find((b) => b.key === 'token')?.value || '';
      auth = { type: 'bearer', bearer: { token } };
    } else if (r.auth.type === 'basic') {
      const username = (r.auth.basic || []).find((b) => b.key === 'username')?.value || '';
      const password = (r.auth.basic || []).find((b) => b.key === 'password')?.value || '';
      auth = { type: 'basic', basic: { username, password } };
    } else if (r.auth.type === 'apikey') {
      const key = (r.auth.apikey || []).find((b) => b.key === 'key')?.value || '';
      const value = (r.auth.apikey || []).find((b) => b.key === 'value')?.value || '';
      auth = { type: 'apikey', apikey: { key, value } };
    }
  }

  return {
    name: item.name || 'Unnamed Request',
    method: (r.method || 'GET').toUpperCase(),
    url,
    headers,
    params,
    body,
    auth,
    collectionId,
    projectId,
    teamId,
    folderId,
    description: typeof r.description === 'string'
      ? r.description
      : (r.description?.content || ''),
  };
}

// POST /api/import
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { postmanJson, projectId, teamId } = req.body;

    if (!postmanJson || !projectId || !teamId) {
      return res.status(400).json(
        { error: 'postmanJson, projectId and teamId are required' }
      );
    }

    let postman;
    try {
      postman = typeof postmanJson === 'string' ? JSON.parse(postmanJson) : postmanJson;
    } catch {
      return res.status(400).json({ error: 'Invalid Postman JSON' });
    }

    const info = postman.info || {};
    const collectionName = info.name || 'Imported Collection';

    // Create collection first
    const collection = await Collection.create({
      name: collectionName,
      projectId,
      teamId,
      createdBy: userId,
      description: info.description || '',
      isImported: true,
      importSource: 'postman',
    });

    const allRequests = [];
    const allFolders = [];

    for (const item of postman.item || []) {
      const { requests, folders } = parsePostmanItem(
        item,
        collection._id,
        projectId,
        teamId
      );
      allRequests.push(...requests);
      allFolders.push(...folders);
    }

    // Save folders to collection
    if (allFolders.length > 0) {
      collection.folders = allFolders;
      await collection.save();
    }

    // Bulk insert — use ordered:false so one bad doc doesn't abort the rest
    let savedRequests = [];
    if (allRequests.length > 0) {
      try {
        savedRequests = await Request.insertMany(allRequests, { ordered: false });
      } catch (insertErr) {
        // insertMany with ordered:false throws BulkWriteError but still inserts valid docs
        if (insertErr.insertedDocs) {
          savedRequests = insertErr.insertedDocs;
        } else {
          console.warn('Some requests failed to insert:', insertErr.message);
          savedRequests = [];
        }
      }
    }

    res.json({
      message: 'Collection imported successfully',
      collection,
      requestCount: savedRequests.length,
      folderCount: allFolders.length,
    });
  } catch (err) {
    console.error('[POST /api/import] Error:', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// POST /api/import/init
// Initialize a collection import
router.post('/init', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { collectionMeta, folders, projectId, teamId } = req.body;

    if (!collectionMeta || !projectId || !teamId) {
      return res.status(400).json({ error: 'collectionMeta, projectId and teamId are required' });
    }

    const collectionName = collectionMeta.name || 'Imported Collection';

    const collection = await Collection.create({
      name: collectionName,
      projectId,
      teamId,
      createdBy: userId,
      description: collectionMeta.description || '',
      isImported: true,
      importSource: 'postman',
      folders: folders || [],
    });

    res.json({
      message: 'Collection initialized successfully',
      collectionId: collection._id,
      collection,
    });
  } catch (err) {
    console.error('[POST /api/import/init] Error:', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// POST /api/import/chunk
// Insert a chunk of requests
router.post('/chunk', authenticate, async (req, res) => {
  try {
    const { collectionId, projectId, teamId, requests } = req.body;

    if (!collectionId || !projectId || !teamId || !requests || !Array.isArray(requests)) {
      return res.status(400).json({ error: 'collectionId, projectId, teamId and requests array are required' });
    }

    // Attach required IDs to each request
    const requestsToInsert = requests.map(reqData => ({
      ...reqData,
      collectionId,
      projectId,
      teamId,
    }));

    let savedRequests = [];
    if (requestsToInsert.length > 0) {
      try {
        savedRequests = await Request.insertMany(requestsToInsert, { ordered: false });
      } catch (insertErr) {
        if (insertErr.insertedDocs) {
          savedRequests = insertErr.insertedDocs;
        } else {
          console.warn('Some requests failed to insert:', insertErr.message);
          savedRequests = [];
        }
      }
    }

    res.json({
      message: `Chunk imported successfully`,
      insertedCount: savedRequests.length,
    });
  } catch (err) {
    console.error('[POST /api/import/chunk] Error:', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

export default router;
