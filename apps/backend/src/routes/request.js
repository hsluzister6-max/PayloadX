import express from 'express';
import Request from '../../models/Request.js';
import Collection from '../../models/Collection.js';
import { authenticate } from '../middleware/auth.js';
import { buildRequestSearchFilter } from '../lib/requestSearch.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Requests
 *   description: API request management (REST, WebSockets, Socket.IO)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Request:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         method:
 *           type: string
 *           enum: [GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS]
 *         url:
 *           type: string
 *         protocol:
 *           type: string
 *           enum: [http, ws, socketio]
 *         collectionId:
 *           type: string
 *         projectId:
 *           type: string
 *         teamId:
 *           type: string
 *         creatorId:
 *           $ref: '#/components/schemas/User'
 *         body:
 *           type: object
 *         headers:
 *           type: array
 *           items:
 *             type: object
 */

// GET /api/request
/**
 * @swagger
 * /api/request:
 *   get:
 *     summary: List requests
 *     description: Returns a list of API requests filtered by collection, project, or team.
 *     tags: [Requests]
 *     parameters:
 *       - in: query
 *         name: collectionId
 *         schema:
 *           type: string
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: teamId
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, URL, route/path, HTTP method, description (e.g. "GET /users", "api/v1")
 *     responses:
 *       200:
 *         description: List of requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requests:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Request'
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { collectionId, projectId, teamId, search } = req.query;

    const query = {};
    if (collectionId) query.collectionId = collectionId;
    if (projectId) query.projectId = projectId;
    if (teamId) query.teamId = teamId;

    const searchFilter = search ? buildRequestSearchFilter(String(search)) : null;
    if (searchFilter) {
      query.$and = [...(query.$and || []), searchFilter];
    }

    const mQuery = Request.find(query)
      .populate('creatorId', 'name email avatar')
      .sort({ order: 1, createdAt: 1 })
      .lean();

    if (search) mQuery.limit(100);

    const requests = await mQuery;
    res.json({ requests });
  } catch (err) {
    console.error('[GET /api/request] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/request:
 *   post:
 *     summary: Create a request
 *     description: Creates a new API request (REST, WebSocket, or Socket.IO).
 *     tags: [Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, collectionId, projectId, teamId]
 *             properties:
 *               name:
 *                 type: string
 *               method:
 *                 type: string
 *               url:
 *                 type: string
 *               protocol:
 *                 type: string
 *               collectionId:
 *                 type: string
 *               projectId:
 *                 type: string
 *               teamId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Request created
 */
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
