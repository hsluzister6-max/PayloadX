import express from 'express';
import ApiDoc from '../../models/ApiDoc.js';
import { authenticate } from '../middleware/auth.js';
import { generateSpec } from '../../lib/swaggerGen.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Documentation
 *   description: User-facing API documentation management (Manual & Swagger-based)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ApiDoc:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         version:
 *           type: string
 *         baseUrl:
 *           type: string
 *         projectId:
 *           type: string
 *         teamId:
 *           type: string
 *         endpoints:
 *           type: array
 *           items:
 *             type: object
 */

// GET /api/apidoc
/**
 * @swagger
 * /api/apidoc:
 *   get:
 *     summary: List API documentations
 *     description: Returns a list of API documentation projects for a team or project.
 *     tags: [Documentation]
 *     parameters:
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: teamId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of docs
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { projectId, teamId } = req.query;

    const query = {};
    if (projectId) query.projectId = projectId;
    if (teamId) query.teamId = teamId;

    // We don't need to load all endpoints for the list view, just summary info
    const docs = await ApiDoc.find(query)
      .select('name description version baseUrl projectId teamId createdAt updatedAt')
      .populate('createdBy', 'name email avatar')
      .sort({ updatedAt: -1 });

    res.json({ docs });
  } catch (err) {
    console.error('API Doc GET error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/apidoc:
 *   post:
 *     summary: Create an API documentation project
 *     description: Starts a new API documentation project (can be manual or later updated via Swagger).
 *     tags: [Documentation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, projectId, teamId]
 *             properties:
 *               name:
 *                 type: string
 *               projectId:
 *                 type: string
 *               teamId:
 *                 type: string
 *               description:
 *                 type: string
 *               version:
 *                 type: string
 *     responses:
 *       201:
 *         description: Doc created
 */
// POST /api/apidoc
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, projectId, teamId, description, version, baseUrl } = req.body;

    if (!name || !projectId || !teamId) {
      return res.status(400).json({ error: 'name, projectId and teamId are required' });
    }

    const doc = await ApiDoc.create({
      name,
      projectId,
      teamId,
      createdBy: userId,
      description,
      version: version || '1.0.0',
      baseUrl: baseUrl || '',
      endpoints: [],
    });

    // Populate createdBy before returning
    await doc.populate('createdBy', 'name email avatar');

    res.status(201).json({ doc });
  } catch (err) {
    console.error('API Doc POST error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/apidoc/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const doc = await ApiDoc.findById(req.params.id)
      .populate('createdBy', 'name email avatar');
    if (!doc) return res.status(404).json({ error: 'ApiDoc not found' });

    res.json({ doc });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/apidoc/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const updated = await ApiDoc.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'ApiDoc not found' });

    res.json({ doc: updated });
  } catch (err) {
    console.error('API Doc PUT error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/apidoc/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const doc = await ApiDoc.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'ApiDoc not found' });

    res.json({ message: 'API Documentation deleted' });
  } catch (err) {
    console.error('API Doc DELETE error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// Endpoints Routes
// ───────────────────────────────────────────────────────────────────────────────

// POST /api/apidoc/:id/endpoints
router.post('/:id/endpoints', authenticate, async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint || !endpoint.id) {
      return res.status(400).json({ error: 'Endpoint object with id is required' });
    }

    const doc = await ApiDoc.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'ApiDoc not found' });
    }

    doc.endpoints.push(endpoint);
    doc.spec = generateSpec(doc); // Auto-update swagger spec
    await doc.save();

    res.json({ doc });
  } catch (err) {
    console.error('Endpoint POST error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/apidoc/:id/endpoints
router.put('/:id/endpoints', authenticate, async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint || !endpoint.id) {
      return res.status(400).json({ error: 'Endpoint object with id is required' });
    }

    const doc = await ApiDoc.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'ApiDoc not found' });
    }

    const index = doc.endpoints.findIndex((e) => e.id === endpoint.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Endpoint not found in doc' });
    }

    doc.endpoints[index] = endpoint;
    doc.spec = generateSpec(doc); // Auto-update swagger spec
    await doc.save();

    res.json({ doc });
  } catch (err) {
    console.error('Endpoint PUT error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/apidoc/:id/endpoints
router.delete('/:id/endpoints', authenticate, async (req, res) => {
  try {
    const { endpointId } = req.query;

    if (!endpointId) {
      return res.status(400).json({ error: 'endpointId query param is required' });
    }

    const doc = await ApiDoc.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'ApiDoc not found' });
    }

    doc.endpoints = doc.endpoints.filter((e) => e.id !== endpointId);
    doc.spec = generateSpec(doc); // Auto-update swagger spec
    await doc.save();

    res.json({ doc });
  } catch (err) {
    console.error('Endpoint DELETE error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// Export Route
// ───────────────────────────────────────────────────────────────────────────────

// GET /api/apidoc/:id/export
router.get('/:id/export', authenticate, async (req, res) => {
  try {
    const doc = await ApiDoc.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'ApiDoc not found' });
    }

    // Always generate a fresh spec from the current endpoints configuration
    const spec = generateSpec(doc);

    // Save to make sure document stays in sync (optional)
    if (JSON.stringify(doc.spec) !== JSON.stringify(spec)) {
      doc.spec = spec;
      await doc.save();
    }

    const filename = `${doc.name.replace(/\s+/g, '_')}_swagger.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(spec, null, 2));
  } catch (err) {
    console.error('API Doc Export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/apidoc/{id}/import-swagger:
 *   post:
 *     summary: Import endpoints from a Swagger/OpenAPI JSON
 *     description: Parses a Swagger JSON and adds its endpoints to the current documentation.
 *     tags: [Documentation]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               spec:
 *                 type: object
 *                 description: The Swagger/OpenAPI JSON object
 *     responses:
 *       200:
 *         description: Endpoints imported successfully
 */
router.post('/:id/import-swagger', authenticate, async (req, res) => {
  try {
    const { spec } = req.body;
    if (!spec || !spec.paths) {
      return res.status(400).json({ error: 'Valid Swagger/OpenAPI spec with "paths" is required' });
    }

    const doc = await ApiDoc.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'ApiDoc not found' });

    const newEndpoints = [];
    const paths = spec.paths;

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, data] of Object.entries(methods)) {
        if (!['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method.toLowerCase())) continue;

        newEndpoints.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          path,
          method: method.toUpperCase(),
          summary: data.summary || '',
          description: data.description || '',
          tags: data.tags || [],
          queryParams: (data.parameters || [])
            .filter(p => p.in === 'query')
            .map(p => ({
              id: Math.random().toString(36).substr(2, 9),
              name: p.name,
              type: p.schema?.type || 'string',
              required: p.required || false,
              description: p.description || ''
            })),
          headers: (data.parameters || [])
            .filter(p => p.in === 'header')
            .map(p => ({
              id: Math.random().toString(36).substr(2, 9),
              key: p.name,
              value: ''
            })),
          requestBody: {
            schema: data.requestBody?.content?.['application/json']?.schema ? JSON.stringify(data.requestBody.content['application/json'].schema) : '{}',
            contentType: 'application/json'
          },
          responses: Object.entries(data.responses || {}).map(([code, resData]) => ({
            id: Math.random().toString(36).substr(2, 9),
            statusCode: parseInt(code) || 200,
            description: resData.description || '',
            schema: resData.content?.['application/json']?.schema ? JSON.stringify(resData.content['application/json'].schema) : '{}',
            contentType: 'application/json'
          }))
        });
      }
    }

    doc.endpoints = [...doc.endpoints, ...newEndpoints];
    doc.spec = generateSpec(doc);
    await doc.save();

    res.json({ doc, importedCount: newEndpoints.length });
  } catch (err) {
    console.error('Swagger Import error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
