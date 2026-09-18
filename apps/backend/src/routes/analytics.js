import express from 'express';
import AnalyticsEvent from '../../models/AnalyticsEvent.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

const ALLOWED_TYPES = new Set(['view', 'click', 'cta_click', 'nav', 'action', 'error']);
const ALLOWED_CLIENTS = new Set(['desktop', 'landing', 'web', 'other']);

function sanitizeEvent(raw, userId) {
  if (!raw || typeof raw !== 'object') return null;
  const section = String(raw.section || '').trim().slice(0, 64);
  const eventType = String(raw.eventType || '').trim();
  if (!section || !ALLOWED_TYPES.has(eventType)) return null;

  return {
    userId: userId || undefined,
    sessionId: String(raw.sessionId || '').slice(0, 64) || undefined,
    section,
    eventType,
    target: String(raw.target || '').slice(0, 128),
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
    client: ALLOWED_CLIENTS.has(raw.client) ? raw.client : 'desktop',
  };
}

/**
 * POST /api/analytics/events
 * Batch ingest product analytics (authenticated preferred).
 * Body: { events: [...] } or a single event object.
 */
router.post('/events', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const payload = req.body?.events || req.body;
    const list = Array.isArray(payload) ? payload : [payload];
    const docs = list
      .slice(0, 50)
      .map((e) => sanitizeEvent(e, userId))
      .filter(Boolean);

    if (!docs.length) {
      return res.status(400).json({ error: 'No valid events' });
    }

    await AnalyticsEvent.insertMany(docs, { ordered: false });
    res.status(201).json({ ok: true, accepted: docs.length });
  } catch (err) {
    console.error('[POST /api/analytics/events]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/analytics/heartbeat
 * Lightweight authenticated ping so presence stays warm when sockets flake.
 */
router.post('/heartbeat', authenticate, async (req, res) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

export default router;
