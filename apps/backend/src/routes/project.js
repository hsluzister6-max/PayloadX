import express from 'express';
import Project from '../../models/Project.js';
import Team from '../../models/Team.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Project management and workspace organization
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Project:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         teamId:
 *           type: string
 *         ownerId:
 *           $ref: '#/components/schemas/User'
 *         description:
 *           type: string
 *         visibility:
 *           type: string
 *           enum: [team, public]
 *         color:
 *           type: string
 */

// GET /api/project?teamId=xxx
/**
 * @swagger
 * /api/project:
 *   get:
 *     summary: List projects
 *     description: Returns projects for a specific team or the user's personal projects.
 *     tags: [Projects]
 *     parameters:
 *       - in: query
 *         name: teamId
 *         schema:
 *           type: string
 *         description: Filter by team ID
 *     responses:
 *       200:
 *         description: List of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 projects:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
 */
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

/**
 * @swagger
 * /api/project:
 *   post:
 *     summary: Create a project
 *     description: Creates a new project within a team.
 *     tags: [Projects]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, teamId]
 *             properties:
 *               name:
 *                 type: string
 *               teamId:
 *                 type: string
 *               description:
 *                 type: string
 *               visibility:
 *                 type: string
 *               color:
 *                 type: string
 *     responses:
 *       201:
 *         description: Project created
 */
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

/**
 * @swagger
 * /api/project/{id}:
 *   get:
 *     summary: Get project details
 *     description: Returns detailed information about a single project.
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project details returned
 */
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
