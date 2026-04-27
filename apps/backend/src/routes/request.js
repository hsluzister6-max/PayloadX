/**
 * Request Routes
 * GET /api/request?collectionId=&projectId=&teamId=&search=
 * POST /api/request
 * GET /api/request/:id
 * PUT /api/request/:id
 * DELETE /api/request/:id
 */

import express from 'express';
import Request from '../../models/Request.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/request
router.get('/', authenticate, async (req, res) => {
  try {
    const { collectionId, projectId, teamId, search } = req.query;

    const query = {};
    if (collectionId) query.collectionId = collectionId;
    if (projectId) query.projectId = projectId;
    if (teamId) query.teamId = teamId;

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { url: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    const mQuery = Request.find(query)
      .populate('creatorId', 'name email avatar')
      .sort({ order: 1, createdAt: 1 });

    if (search) mQuery.limit(50);

    const requests = await mQuery;
    res.json({ requests });
  } catch (err) {
    console.error('[GET /api/request] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/request
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, method, url, collectionId, projectId, teamId, protocol } = req.body;
    const userId = req.user.id;

    if (!name || !collectionId || !projectId || !teamId) {
      return res.status(400).json({ error: 'name, collectionId, projectId, teamId required' });
    }

    const finalProtocol = protocol || 'http';
    console.log(`[API POST] Creating request: "${name}" | Protocol: ${finalProtocol} | Method: ${method || 'N/A'}`);

    const methodField = finalProtocol === 'http' ? (method || 'GET') : undefined;

    const createData = {
      ...req.body,
      name,
      url,
      protocol: finalProtocol,
      collectionId,
      projectId,
      teamId,
      creatorId: userId,
    };

    if (methodField) {
      createData.method = methodField;
    }

    const newReq = await Request.create(createData);

    const populated = await Request.findById(newReq._id).populate('creatorId', 'name email avatar');

    res.status(201).json({ request: populated });
  } catch (err) {
    console.error('[API POST /request] Error:', err.message);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message, details: err.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/request/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const requestDoc = await Request.findById(req.params.id).populate('creatorId', 'name email avatar');
    if (!requestDoc) return res.status(404).json({ error: 'Request not found' });
    res.json({ request: requestDoc });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/request/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const body = { ...req.body };

    // Never allow the frontend to override or change creatorId
    delete body.creatorId;

    console.log(`[API PUT] Updating request: ${req.params.id} | Protocol: ${body.protocol || 'N/A'}`);

    const updated = await Request.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true })
      .populate('creatorId', 'name email avatar');
    if (!updated) return res.status(404).json({ error: 'Request not found' });
    res.json({ request: updated });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/request/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await Request.findByIdAndDelete(req.params.id);
    res.json({ message: 'Request deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
