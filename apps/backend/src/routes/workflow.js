import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { db } from '../lib/firebase.js';
import User from '../../models/User.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Workflow:
 *       type: object
 *       required:
 *         - name
 *         - teamId
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         teamId:
 *           type: string
 *         projectId:
 *           type: string
 *         nodes:
 *           type: array
 *           items:
 *             type: object
 *         edges:
 *           type: array
 *           items:
 *             type: object
 *         createdBy:
 *           type: object
 *         version:
 *           type: number
 *         createdAt:
 *           type: string
 *         updatedAt:
 *           type: string
 */

// ─── Workflow Routes ────────────────────────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Firestore not initialized. Check backend environment variables.' });
    }

    const { teamId, projectId, search } = req.query;
    let query = db.collection('workflows');

    if (teamId) query = query.where('teamId', '==', teamId);
    if (projectId) query = query.where('projectId', '==', projectId);

    const snapshot = await query.get();
    let workflows = snapshot.docs.map(doc => ({
      _id: doc.id,
      id: doc.id,
      ...doc.data()
    }));

    // Sort in memory to avoid index requirements for now
    workflows.sort((a, b) => {
      const dateA = new Date(a.updatedAt || 0);
      const dateB = new Date(b.updatedAt || 0);
      return dateB - dateA;
    });

    if (search) {
      const searchLower = search.toLowerCase();
      workflows = workflows.filter(w => w.name.toLowerCase().includes(searchLower));
    }

    // Manual populate for createdBy (User is in MongoDB)
    const userIds = [...new Set(workflows.map(w => w.createdBy))].filter(id => id);
    const users = await User.find({ _id: { $in: userIds } }).select('name email').lean();
    const userMap = users.reduce((acc, user) => {
      acc[user._id.toString()] = user;
      return acc;
    }, {});

    workflows = workflows.map(w => ({
      ...w,
      createdBy: userMap[w.createdBy] || { _id: w.createdBy, name: 'Unknown' }
    }));

    res.json({ workflows });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Firestore not initialized' });
    }

    const doc = await db.collection('workflows').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const workflowData = doc.data();
    const workflow = {
      _id: doc.id,
      id: doc.id,
      ...workflowData
    };

    // Manual populate for createdBy
    if (workflow.createdBy) {
      const user = await User.findById(workflow.createdBy).select('name email').lean();
      workflow.createdBy = user || { _id: workflow.createdBy, name: 'Unknown' };
    }

    res.json({ workflow });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description, teamId, projectId, nodes, edges } = req.body;

    if (!name || !teamId) {
      return res.status(400).json({ error: 'Name and teamId are required' });
    }

    if (!db) {
      return res.status(503).json({ error: 'Firestore not initialized' });
    }

    const now = new Date().toISOString();
    const workflowPayload = {
      name,
      description: description || '',
      teamId,
      projectId: projectId || null,
      nodes: nodes || [],
      edges: edges || [],
      createdBy: req.user.id,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection('workflows').add(workflowPayload);

    // Fetch and return populated
    const user = await User.findById(req.user.id).select('name email').lean();
    const workflow = {
      _id: docRef.id,
      id: docRef.id,
      ...workflowPayload,
      createdBy: user || { _id: req.user.id, name: req.user.name || 'Current User' }
    };

    res.status(201).json({ workflow });
  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(500).json({ error: error.message || 'Failed to create workflow' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Firestore not initialized' });
    }

    const { name, description, nodes, edges } = req.body;
    const docRef = db.collection('workflows').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const currentData = doc.data();
    const updates = {
      updatedAt: new Date().toISOString(),
      version: (currentData.version || 0) + 1
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (nodes !== undefined) updates.nodes = nodes;
    if (edges !== undefined) updates.edges = edges;

    await docRef.update(updates);

    // Fetch updated and populate
    const updatedDoc = await docRef.get();
    const workflow = {
      _id: updatedDoc.id,
      id: updatedDoc.id,
      ...updatedDoc.data()
    };

    if (workflow.createdBy) {
      const user = await User.findById(workflow.createdBy).select('name email').lean();
      workflow.createdBy = user || { _id: workflow.createdBy, name: 'Unknown' };
    }

    res.json({ workflow });
  } catch (error) {
    console.error('Error updating workflow:', error);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Firestore not initialized' });
    }

    const docRef = db.collection('workflows').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    await docRef.delete();
    res.json({ message: 'Workflow deleted successfully' });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

export default router;
