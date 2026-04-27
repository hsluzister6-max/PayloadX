import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Collection from '@/models/Collection';
import Request from '@/models/Request';
import { authenticate } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

/**
 * Postman Collection v2.1 → SyncNest internal schema converter
 */
function parsePostmanItem(item, collectionId, projectId, teamId) {
  const requests = [];
  const folders = [];

  if (item.item) {
    // It's a folder
    const folderId = uuidv4();
    const folderRequestIds = [];

    item.item.forEach((subItem) => {
      if (subItem.item) {
        // Nested folder — flatten one level
        const { requests: subRequests } = parsePostmanItem(subItem, collectionId, projectId, teamId);
        requests.push(...subRequests);
      } else {
        const req = buildRequest(subItem, collectionId, projectId, teamId, folderId);
        folderRequestIds.push(req._id || uuidv4());
        requests.push(req);
      }
    });

    folders.push({ id: folderId, name: item.name, requestIds: folderRequestIds });
  } else {
    // It's a request
    requests.push(buildRequest(item, collectionId, projectId, teamId, null));
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

export async function POST(request) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const body = await request.json();
    const { postmanJson, projectId, teamId } = body;

    if (!postmanJson || !projectId || !teamId) {
      return NextResponse.json(
        { error: 'postmanJson, projectId and teamId are required' },
        { status: 400 }
      );
    }

    let postman;
    try {
      postman = typeof postmanJson === 'string' ? JSON.parse(postmanJson) : postmanJson;
    } catch {
      return NextResponse.json({ error: 'Invalid Postman JSON' }, { status: 400 });
    }

    const info = postman.info || {};
    const collectionName = info.name || 'Imported Collection';

    // Create collection first
    const collection = await Collection.create({
      name: collectionName,
      projectId,
      teamId,
      createdBy: user.id,
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

    return NextResponse.json({
      message: 'Collection imported successfully',
      collection,
      requestCount: savedRequests.length,
      folderCount: allFolders.length,
    });
  } catch (err) {
    console.error('[POST /api/import] Error:', err.message, err.stack);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
