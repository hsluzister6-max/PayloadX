// Triggering nodemon restart
/**
 * Team Routes
 * GET /api/team
 * POST /api/team
 * GET /api/team/:id
 * PUT /api/team/:id
 * DELETE /api/team/:id
 */

import express from 'express';
import Team from '../../models/Team.js';
import User from '../../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// GET /api/team — list user's teams
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const teams = await Team.find({
      $or: [{ ownerId: userId }, { 'members.userId': userId }],
    }).populate('ownerId', 'name email avatar');

    res.json({ teams });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/team — create team
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description } = req.body;

    if (!name) return res.status(400).json({ error: 'Team name is required' });

    const team = await Team.create({
      name,
      description,
      ownerId: userId,
      members: [{ userId: userId, role: 'admin' }],
      inviteToken: uuidv4(),
    });

    res.status(201).json({ team });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/team/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const team = await Team.findById(req.params.id)
      .populate('ownerId', 'name email avatar')
      .populate('members.userId', 'name email avatar');

    if (!team) return res.status(404).json({ error: 'Team not found' });

    const isMember = team.members.some((m) => m.userId._id.toString() === userId) ||
      team.ownerId._id.toString() === userId;
    if (!isMember) return res.status(403).json({ error: 'Forbidden' });

    res.json({ team });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/team/:id/invite
router.post('/:id/invite', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, role = 'developer' } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Permission check: only admin or owner
    const isAdmin = team.members.some(
      (m) => m.userId.toString() === userId && m.role === 'admin'
    ) || team.ownerId.toString() === userId;

    if (!isAdmin) return res.status(403).json({ error: 'Only admins can invite members' });

    // Find the user to invite
    const invitedUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (!invitedUser) {
      return res.status(404).json({ error: 'User not found. They must sign up first.' });
    }

    // Check if already a member
    const alreadyMember = team.members.some(
      (m) => m.userId.toString() === invitedUser._id.toString()
    );
    if (alreadyMember) return res.status(409).json({ error: 'User is already a member' });

    // Add member
    team.members.push({ userId: invitedUser._id, role });
    await team.save();

    // Populate for response
    const updatedTeam = await Team.findById(team._id)
      .populate('ownerId', 'name email avatar')
      .populate('members.userId', 'name email avatar');

    res.json({ message: 'Member invited successfully', team: updatedTeam });
  } catch (err) {
    console.error('[POST /api/team/:id/invite] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/team/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const team = await Team.findById(req.params.id);

    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.ownerId.toString() !== userId) return res.status(403).json({ error: 'Forbidden' });

    const updated = await Team.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ team: updated });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/team/:id/members/:userId
router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  try {
    const requestingUserId = req.user.id;
    const { id: teamId, userId: memberToRemoveId } = req.params;

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Permission check: only admin or owner can remove others, or user can remove themselves
    const isAdmin = team.members.some(
      (m) => m.userId.toString() === requestingUserId && m.role === 'admin'
    ) || team.ownerId.toString() === requestingUserId;

    if (!isAdmin && requestingUserId !== memberToRemoveId) {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }

    if (team.ownerId.toString() === memberToRemoveId) {
      return res.status(400).json({ error: 'Cannot remove the team owner' });
    }

    // Remove member
    team.members = team.members.filter(m => m.userId.toString() !== memberToRemoveId);
    await team.save();

    // Populate for response
    const updatedTeam = await Team.findById(team._id)
      .populate('ownerId', 'name email avatar')
      .populate('members.userId', 'name email avatar');

    res.json({ message: 'Member removed successfully', team: updatedTeam });
  } catch (err) {
    console.error('[DELETE /api/team/:id/members/:userId] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/team/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const team = await Team.findById(req.params.id);

    // If not found, still return success (idempotent delete)
    if (!team) {
      return res.json({
        message: 'Team deleted',
        teamId: req.params.id
      });
    }

    if (team.ownerId.toString() !== userId) return res.status(403).json({ error: 'Forbidden' });

    await Team.findByIdAndDelete(req.params.id);
    res.json({
      message: 'Team deleted',
      teamId: req.params.id
    });
  } catch (err) {
    console.error('[DELETE /api/team/:id] Error:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

export default router;
