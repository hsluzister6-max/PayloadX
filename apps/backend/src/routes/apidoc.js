/**
 * API Documentation Routes
 * GET /api/apidoc?projectId=&teamId=
 * POST /api/apidoc
 * GET /api/apidoc/:id
 * PUT /api/apidoc/:id
 * DELETE /api/apidoc/:id
 * POST /api/apidoc/:id/endpoints
 * PUT /api/apidoc/:id/endpoints
 * DELETE /api/apidoc/:id/endpoints
 * GET /api/apidoc/:id/export
 */

import express from 'express';
import ApiDoc from '../../models/ApiDoc.js';
import { authenticate } from '../middleware/auth.js';
import { generateSpec } from '../../lib/swaggerGen.js';

const router = express.Router();

// GET /api/apidoc
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

export default router;
