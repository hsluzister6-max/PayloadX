import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { db } from '../lib/firebase.js';
import User from '../../models/User.js';

const router = express.Router();

// GET /api/workflow-execution - List executions
router.get('/', authenticate, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Firestore not initialized' });
    }

    const { workflowId, teamId, status, limit = 50 } = req.query;
    let query = db.collection('workflow_executions');

    if (workflowId) query = query.where('workflowId', '==', workflowId);
    if (teamId) query = query.where('teamId', '==', teamId);
    if (status) query = query.where('status', '==', status);

    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .get();

    let executions = snapshot.docs.map(doc => ({
      _id: doc.id,
      id: doc.id,
      ...doc.data()
    }));

    // Manual populate for executedBy (MongoDB) and workflowId (Firestore)
    const userIds = [...new Set(executions.map(e => e.executedBy))].filter(id => id);
    const users = await User.find({ _id: { $in: userIds } }).select('name email').lean();
    const userMap = users.reduce((acc, user) => {
      acc[user._id.toString()] = user;
      return acc;
    }, {});

    const workflowIds = [...new Set(executions.map(e => e.workflowId))].filter(id => id);
    const workflowDocs = await Promise.all(
      workflowIds.map(id => db.collection('workflows').doc(id).get())
    );
    const workflowMap = workflowDocs.reduce((acc, doc) => {
      if (doc.exists) acc[doc.id] = { _id: doc.id, name: doc.data().name };
      return acc;
    }, {});

    executions = executions.map(e => ({
      ...e,
      executedBy: userMap[e.executedBy] || { _id: e.executedBy, name: 'Unknown' },
      workflowId: workflowMap[e.workflowId] || { _id: e.workflowId, name: 'Deleted Workflow' }
    }));

    res.json({ executions });
  } catch (error) {
    console.error('Error fetching executions:', error);
    res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

// GET /api/workflow-execution/:id - Get execution details
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Firestore not initialized' });
    }

    const doc = await db.collection('workflow_executions').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    const execution = {
      _id: doc.id,
      id: doc.id,
      ...doc.data()
    };

    // Manual populate
    if (execution.executedBy) {
      const user = await User.findById(execution.executedBy).select('name email').lean();
      execution.executedBy = user || { _id: execution.executedBy, name: 'Unknown' };
    }

    if (execution.workflowId) {
      const wDoc = await db.collection('workflows').doc(execution.workflowId).get();
      if (wDoc.exists) {
        execution.workflowId = { _id: wDoc.id, ...wDoc.data() };
      } else {
        execution.workflowId = { _id: execution.workflowId, name: 'Deleted Workflow' };
      }
    }

    res.json({ execution });
  } catch (error) {
    console.error('Error fetching execution:', error);
    res.status(500).json({ error: 'Failed to fetch execution details' });
  }
});

// POST /api/workflow-execution - Save execution result
router.post('/', authenticate, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Firestore not initialized' });
    }

    const {
      workflow_id,
      workflow_name,
      start_time,
      end_time,
      duration,
      status,
      total_nodes,
      success_count,
      failed_count,
      skipped_count,
      node_results,
      teamId,
      environmentId,
      environmentName,
    } = req.body;

    const now = new Date().toISOString();
    const executionPayload = {
      workflowId: workflow_id,
      workflowName: workflow_name,
      teamId: teamId || null,
      executedBy: req.user.id,
      start_time,
      end_time,
      duration,
      status,
      total_nodes,
      success_count,
      failed_count,
      skipped_count,
      node_results,
      environmentId: environmentId || null,
      environmentName: environmentName || null,
      createdAt: now,
    };

    // Clean undefined values for Firestore
    Object.keys(executionPayload).forEach(key => 
      executionPayload[key] === undefined && delete executionPayload[key]
    );

    const docRef = await db.collection('workflow_executions').add(executionPayload);

    res.status(201).json({ 
      execution: {
        _id: docRef.id,
        id: docRef.id,
        ...executionPayload
      }
    });
  } catch (error) {
    console.error('Error saving execution:', error);
    res.status(500).json({ error: 'Failed to save execution result', details: error.message });
  }
});

export default router;
