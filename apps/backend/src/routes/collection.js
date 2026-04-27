/**
 * Collection Routes
 * GET /api/collection?projectId=&teamId=
 * POST /api/collection
 * GET /api/collection/:id
 * PUT /api/collection/:id
 * DELETE /api/collection/:id
 */

import express from 'express';
import Collection from '../../models/Collection.js';
import Request from '../../models/Request.js';
import User from '../../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// GET /api/collection
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
