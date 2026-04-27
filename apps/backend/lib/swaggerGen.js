/**
 * swaggerGen.js
 * Converts an ApiDoc document into a valid OpenAPI 3.0.0 specification object.
 */

const METHOD_WITH_BODY = ['post', 'put', 'patch'];

/**
 * Safely parse a JSON string; return {} on failure.
 */
function safeParse(str) {
  try {
    return JSON.parse(str || '{}');
  } catch {
    return {};
  }
}

/**
 * Map our simple type strings to OpenAPI schema types.
 */
function mapType(t) {
  const map = { string: 'string', number: 'number', integer: 'integer', boolean: 'boolean', array: 'array', object: 'object' };
  return map[t] || 'string';
}

/**
 * Convert a single endpoint to an OpenAPI path-item operation object.
 */
function buildOperation(endpoint) {
  const op = {};

  if (endpoint.summary)     op.summary     = endpoint.summary;
  if (endpoint.description) op.description = endpoint.description;
  if (endpoint.tags?.length) op.tags       = endpoint.tags;
  if (endpoint.deprecated)  op.deprecated  = true;

  op.operationId = `${endpoint.method.toLowerCase()}_${endpoint.path.replace(/\//g, '_').replace(/[{}]/g, '').replace(/^_/, '')}`;

  // ── Query Parameters ─────────────────────────────────
  const parameters = [];

  (endpoint.queryParams || []).forEach((qp) => {
    parameters.push({
      name:        qp.name,
      in:          'query',
      required:    qp.required || false,
      description: qp.description || '',
      schema:      { type: mapType(qp.type) },
    });
  });

  // ── Path parameters (auto-detected from {param} in path) ──
  const pathParamRe = /\{([^}]+)\}/g;
  let match;
  while ((match = pathParamRe.exec(endpoint.path)) !== null) {
    if (!parameters.find((p) => p.name === match[1] && p.in === 'path')) {
      parameters.push({
        name:     match[1],
        in:       'path',
        required: true,
        schema:   { type: 'string' },
      });
    }
  }

  // ── Header Parameters ────────────────────────────────
  (endpoint.headers || []).forEach((h) => {
    if (h.key && !['authorization', 'content-type'].includes(h.key.toLowerCase())) {
      parameters.push({
        name:   h.key,
        in:     'header',
        schema: { type: 'string' },
      });
    }
  });

  if (parameters.length) op.parameters = parameters;

  // ── Request Body ─────────────────────────────────────
  const method = endpoint.method.toLowerCase();
  if (METHOD_WITH_BODY.includes(method)) {
    const schema = safeParse(endpoint.requestBody?.schema);
    if (Object.keys(schema).length) {
      op.requestBody = {
        required: true,
        content: {
          [endpoint.requestBody?.contentType || 'application/json']: {
            schema,
          },
        },
      };
    }
  }

  // ── Responses ─────────────────────────────────────────
  const responses = {};
  (endpoint.responses || []).forEach((r) => {
    const schema = safeParse(r.schema);
    const responseObj = { description: r.description || '' };

    if (Object.keys(schema).length) {
      responseObj.content = {
        [r.contentType || 'application/json']: { schema },
      };
    }
    responses[String(r.statusCode)] = responseObj;
  });

  // Ensure at least a default 200 response exists
  if (!Object.keys(responses).length) {
    responses['200'] = { description: 'Success' };
  }
  op.responses = responses;

  return op;
}

/**
 * Generate a full OpenAPI 3.0.0 spec from an ApiDoc document.
 *
 * @param {Object} doc  - Mongoose ApiDoc document (plain object or Mongoose doc)
 * @returns {Object}    - OpenAPI 3.0.0 spec object
 */
export function generateSpec(doc) {
  const paths = {};

  (doc.endpoints || []).forEach((endpoint) => {
    const pathKey = endpoint.path.startsWith('/') ? endpoint.path : `/${endpoint.path}`;
    if (!paths[pathKey]) paths[pathKey] = {};
    paths[pathKey][endpoint.method.toLowerCase()] = buildOperation(endpoint);
  });

  const spec = {
    openapi: '3.0.0',
    info: {
      title:       doc.name || 'API Documentation',
      description: doc.description || '',
      version:     doc.version || '1.0.0',
    },
    paths,
  };

  // Add servers block if baseUrl is set
  if (doc.baseUrl) {
    spec.servers = [{ url: doc.baseUrl }];
  }

  return spec;
}
