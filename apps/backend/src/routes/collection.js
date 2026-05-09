import express from 'express';
import Collection from '../../models/Collection.js';
import Request from '../../models/Request.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Collections
 *   description: API collection management and organization (Folders & Requests)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Collection:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         projectId:
 *           type: string
 *         teamId:
 *           type: string
 *         description:
 *           type: string
 *         folders:
 *           type: array
 *           items:
 *             type: object
 *         createdBy:
 *           $ref: '#/components/schemas/User'
 */

// GET /api/collection
/**
 * @swagger
 * /api/collection:
 *   get:
 *     summary: List collections
 *     description: Returns a list of API collections for a specific project or team.
 *     tags: [Collections]
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
 *         description: List of collections
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { projectId, teamId } = req.query;

    const query = {};
    if (projectId) query.projectId = projectId;
    if (teamId) query.teamId = teamId;

    const collections = await Collection.find(query)
      .populate('createdBy', 'name email avatar')
      .sort({ updatedAt: -1 });

    res.json({ collections });
  } catch (err) {
    console.error('[GET /api/collection] Error:', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

/**
 * @swagger
 * /api/collection:
 *   post:
 *     summary: Create a collection
 *     description: Creates a new API collection to group requests.
 *     tags: [Collections]
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
 *     responses:
 *       201:
 *         description: Collection created
 */
// POST /api/collection
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, projectId, teamId, description } = req.body;
    const userId = req.user.id;

    if (!name || !projectId || !teamId) {
      return res.status(400).json({ error: 'name, projectId and teamId are required' });
    }

    const collection = await Collection.create({
      name,
      projectId,
      teamId,
      createdBy: userId,
      description,
    });

    res.status(201).json({ collection });
  } catch (err) {
    console.error('[POST /api/collection] Error:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// GET /api/collection/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id).populate('createdBy', 'name email');
    if (!collection) return res.status(404).json({ error: 'Collection not found' });

    const requests = await Request.find({ collectionId: req.params.id }).sort({ order: 1, createdAt: 1 });
    res.json({ collection, requests });
  } catch (err) {
    console.error('[GET /api/collection/:id] Error:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// PUT /api/collection/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const updated = await Collection.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Collection not found' });
    res.json({ collection: updated });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/collection/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    // Idempotent delete
    await Collection.findByIdAndDelete(req.params.id);
    // Also delete associated requests
    await Request.deleteMany({ collectionId: req.params.id });
    res.json({
      message: 'Collection and requests deleted',
      collectionId: req.params.id
    });
  } catch (err) {
    console.error('[DELETE /api/collection/:id] Error:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

/** ── FOLDER MANAGEMENT ── **/

// POST /api/collection/:id/folder
router.post('/:id/folder', authenticate, async (req, res) => {
  try {
    const { name, description, parentId } = req.body;
    if (!name) return res.status(400).json({ error: 'Folder name is required' });

    const collection = await Collection.findById(req.params.id);
    if (!collection) return res.status(404).json({ error: 'Collection not found' });

    const newFolder = {
      id: uuidv4(),
      name,
      parentId: parentId || null,
      description: description || '',
      requestIds: [],
      order: collection.folders.length,
    };

    collection.folders.push(newFolder);
    await collection.save();

    res.status(201).json({ collection, folder: newFolder });
  } catch (err) {
    console.error('[POST /folder] Error:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// PUT /api/collection/:id/folder/:folderId
router.put('/:id/folder/:folderId', authenticate, async (req, res) => {
  try {
    const { name, description } = req.body;
    const collection = await Collection.findById(req.params.id);
    if (!collection) return res.status(404).json({ error: 'Collection not found' });

    const folder = collection.folders.find(f => f.id === req.params.folderId);
    if (!folder) return res.status(404).json({ error: 'Folder not found' });

    if (name) folder.name = name;
    if (description !== undefined) folder.description = description;

    await collection.save();
    res.json({ collection, folder });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/collection/:id/folder/:folderId
router.delete('/:id/folder/:folderId', authenticate, async (req, res) => {
  try {
    const { id, folderId } = req.params;
    const collection = await Collection.findById(id);
    if (!collection) return res.status(404).json({ error: 'Collection not found' });

    // Find all subfolders (recursive)
    const folderIdsToDelete = [folderId];
    let index = 0;
    while (index < folderIdsToDelete.length) {
      const pid = folderIdsToDelete[index++];
      const subfolders = collection.folders.filter(f => f.parentId === pid);
      subfolders.forEach(sf => folderIdsToDelete.push(sf.id));
    }

    // Remove folders from collection
    collection.folders = collection.folders.filter(f => !folderIdsToDelete.includes(f.id));
    await collection.save();

    // Update requests to remove folderId (move to root)
    await Request.updateMany(
      { collectionId: id, folderId: { $in: folderIdsToDelete } },
      { folderId: null }
    );

    res.json({ collection, message: 'Folders deleted, requests moved to root' });
  } catch (err) {
    console.error('[DELETE /folder] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
