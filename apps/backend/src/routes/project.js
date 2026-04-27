/**
 * Project Routes
 * GET /api/project?teamId=
 * POST /api/project
 * GET /api/project/:id
 * PUT /api/project/:id
 * DELETE /api/project/:id
 */

import express from 'express';
import Project from '../../models/Project.js';
import Team from '../../models/Team.js';
import User from '../../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/project?teamId=xxx
router.get('/', authenticate, async (req, res) => {
  try {
    const { teamId } = req.query;
    const userId = req.user.id;

    let query;

    if (teamId) {
      // Verify the requesting user is actually a member (or owner) of this team
      const team = await Team.findById(teamId);
      if (!team) return res.status(404).json({ error: 'Team not found' });

      const isMember =
        team.ownerId.toString() === userId ||
        team.members.some((m) => m.userId.toString() === userId);

      if (!isMember) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Return ALL projects that belong to this team
      query = { teamId };
    } else {
      // No teamId supplied — fall back to personal scope
      query = { $or: [{ ownerId: userId }, { 'members.userId': userId }] };
    }

    const projects = await Project.find(query)
      .populate('ownerId', 'name email avatar')
      .sort({ updatedAt: -1 });

    res.json({ projects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/project
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, teamId, description, visibility = 'team', color } = req.body;
    const userId = req.user.id;

    if (!name || !teamId) {
      return res.status(400).json({ error: 'Name and teamId are required' });
    }

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const project = await Project.create({
      name,
      teamId,
      ownerId: userId,
      description,
      visibility,
      color,
      members: [{ userId: userId, role: 'admin' }],
    });

    res.status(201).json({ project });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/project/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('ownerId', 'name email avatar')
      .populate('members.userId', 'name email avatar');

    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/project/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Check if user is owner or admin of the project
    const isOwner = project.ownerId.toString() === userId;
    const isAdmin = project.members?.some(m =>
      m.userId.toString() === userId && m.role === 'admin'
    );

    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const updated = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ project: updated });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/project/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const project = await Project.findById(req.params.id);

    // If not found, still return success (idempotent delete)
    if (!project) {
      return res.json({
        message: 'Project deleted',
        projectId: req.params.id
      });
    }

    // Check if user is owner or admin of the project
    const isOwner = project.ownerId.toString() === userId;
    const isAdmin = project.members?.some(m =>
      m.userId.toString() === userId && m.role === 'admin'
    );

    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    await Project.findByIdAndDelete(req.params.id);
    res.json({
      message: 'Project deleted',
      projectId: req.params.id
    });
  } catch (err) {
    console.error('[DELETE /api/project/:id] Error:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

export default router;
