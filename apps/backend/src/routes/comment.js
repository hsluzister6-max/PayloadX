/**
 * Comment Routes
 * GET /api/comment?requestId=
 * POST /api/comment
 * DELETE /api/comment/:id
 */

import express from 'express';
import Comment from '../../models/Comment.js';
import User from '../../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/comment?requestId=xxx
router.get('/', authenticate, async (req, res) => {
  try {
    const { requestId } = req.query;

    if (!requestId) {
      return res.status(400).json({ error: 'requestId query param is required' });
    }

    const comments = await Comment.find({ requestId })
      .populate('userId', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json({ comments });
  } catch (err) {
    console.error('[GET /api/comment] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/comment
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId, text } = req.body;

    if (!requestId || !text?.trim()) {
      return res.status(400).json({ error: 'requestId and text are required' });
    }

    const comment = await Comment.create({
      requestId,
      userId,
      text: text.trim(),
    });

    // Populate user before returning
    await comment.populate('userId', 'name email avatar');

    res.status(201).json({ comment });
  } catch (err) {
    console.error('[POST /api/comment] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/comment/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only allow the comment author to delete
    if (comment.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await Comment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    console.error('[DELETE /api/comment/:id] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
