import express from 'express';
import mongoose from 'mongoose';
import Request from '../../models/Request.js';
import Collection from '../../models/Collection.js';
import RequestRun from '../../models/RequestRun.js';
import Team from '../../models/Team.js';
import { authenticate } from '../middleware/auth.js';
import { logActivity } from '../lib/activityLog.js';

const router = express.Router();

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toObjectId(id) {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return null;
  return new mongoose.Types.ObjectId(String(id));
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function subDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function formatKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatLabel(date, shortWeekday) {
  if (shortWeekday) return WEEKDAYS[date.getDay()];
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

async function assertTeamAccess(teamId, userId) {
  const team = await Team.findById(teamId).select('ownerId members.userId').lean();
  if (!team) return { ok: false, status: 404, error: 'Team not found' };
  const uid = String(userId);
  const isMember =
    String(team.ownerId) === uid ||
    (team.members || []).some((m) => String(m.userId) === uid);
  if (!isMember) return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: true };
}

function dayBuckets(days) {
  const today = startOfDay(new Date());
  const buckets = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = subDays(today, i);
    buckets.push({
      key: formatKey(day),
      label: formatLabel(day, days <= 10),
      created: 0,
      runs: 0,
      avgMs: 0,
    });
  }
  return buckets;
}

/**
 * GET /api/dashboard?teamId=&projectId=&createdDays=14&runDays=7
 * Aggregated analytics for the project dashboard.
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const teamOid = toObjectId(req.query.teamId);
    const projectOid = toObjectId(req.query.projectId);
    if (!teamOid) {
      return res.status(400).json({ error: 'teamId is required' });
    }

    const access = await assertTeamAccess(teamOid, req.user.id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

    const createdDays = Math.min(Math.max(Number(req.query.createdDays) || 14, 7), 90);
    const runDays = Math.min(Math.max(Number(req.query.runDays) || 7, 7), 90);

    const requestMatch = { teamId: teamOid };
    const collectionMatch = { teamId: teamOid };
    const runMatch = { teamId: teamOid };
    if (projectOid) {
      requestMatch.projectId = projectOid;
      collectionMatch.projectId = projectOid;
      runMatch.projectId = projectOid;
    }

    const createdSince = subDays(startOfDay(new Date()), createdDays - 1);
    const runSince = subDays(startOfDay(new Date()), runDays - 1);

    const [
      collectionsCount,
      totalApis,
      protocolCounts,
      methodAgg,
      collectionAgg,
      createdAgg,
      recentlyCreated,
      runsTotal,
      runsSuccess,
      runDayAgg,
      recentRuns,
    ] = await Promise.all([
      Collection.countDocuments(collectionMatch),
      Request.countDocuments(requestMatch),
      Request.aggregate([
        { $match: requestMatch },
        { $group: { _id: '$protocol', count: { $sum: 1 } } },
      ]),
      Request.aggregate([
        { $match: requestMatch },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ['$protocol', 'ws'] },
                'WS',
                {
                  $cond: [
                    { $eq: ['$protocol', 'socketio'] },
                    'SOCKETIO',
                    { $ifNull: ['$method', 'GET'] },
                  ],
                },
              ],
            },
            value: { $sum: 1 },
          },
        },
        { $sort: { value: -1 } },
      ]),
      Request.aggregate([
        { $match: requestMatch },
        { $group: { _id: '$collectionId', apis: { $sum: 1 } } },
        { $sort: { apis: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'collections',
            localField: '_id',
            foreignField: '_id',
            as: 'collection',
          },
        },
        {
          $project: {
            collectionId: '$_id',
            apis: 1,
            name: {
              $ifNull: [{ $arrayElemAt: ['$collection.name', 0] }, 'Uncategorized'],
            },
          },
        },
      ]),
      Request.aggregate([
        { $match: { ...requestMatch, createdAt: { $gte: createdSince } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            created: { $sum: 1 },
          },
        },
      ]),
      Request.find(requestMatch)
        .sort({ createdAt: -1 })
        .limit(12)
        .select('name method protocol url collectionId createdAt updatedAt')
        .lean(),
      RequestRun.countDocuments(runMatch),
      RequestRun.countDocuments({ ...runMatch, success: true }),
      RequestRun.aggregate([
        { $match: { ...runMatch, createdAt: { $gte: runSince } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            runs: { $sum: 1 },
            avgMs: { $avg: '$responseTimeMs' },
          },
        },
      ]),
      RequestRun.find(runMatch)
        .sort({ createdAt: -1 })
        .limit(12)
        .select('name method protocol url status responseTimeMs success createdAt requestId')
        .lean(),
    ]);

    const protocolMap = Object.fromEntries(protocolCounts.map((p) => [p._id || 'http', p.count]));
    const ws = (protocolMap.ws || 0) + (protocolMap.socketio || 0);
    const rest = totalApis - ws;

    const createdBuckets = dayBuckets(createdDays);
    const createdIndex = Object.fromEntries(createdBuckets.map((b, i) => [b.key, i]));
    createdAgg.forEach((row) => {
      const idx = createdIndex[row._id];
      if (idx != null) createdBuckets[idx].created = row.created;
    });

    const runBuckets = dayBuckets(runDays);
    const runIndex = Object.fromEntries(runBuckets.map((b, i) => [b.key, i]));
    runDayAgg.forEach((row) => {
      const idx = runIndex[row._id];
      if (idx != null) {
        runBuckets[idx].runs = row.runs;
        runBuckets[idx].avgMs = row.avgMs != null ? Math.round(row.avgMs) : 0;
      }
    });

    res.json({
      stats: {
        collections: collectionsCount,
        totalApis,
        rest,
        ws,
        runs: runsTotal,
        successRate: runsTotal ? Math.round((runsSuccess / runsTotal) * 100) : 0,
      },
      createdOverTime: createdBuckets.map(({ key, label, created }) => ({ key, label, created })),
      methodDistribution: methodAgg.map((m) => ({ name: m._id || 'OTHER', value: m.value })),
      collectionBreakdown: collectionAgg.map((c) => ({
        collectionId: c.collectionId,
        name: c.name,
        apis: c.apis,
      })),
      runAnalytics: runBuckets.map(({ label, runs, avgMs }) => ({ label, runs, avgMs })),
      recentlyCreated,
      recentRuns,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/dashboard]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/dashboard/runs
 * Record a single API execution for analytics.
 */
router.post('/runs', authenticate, async (req, res) => {
  try {
    const {
      teamId,
      projectId,
      requestId,
      name,
      method,
      protocol,
      url,
      status,
      statusText,
      responseTimeMs,
      sizeBytes,
      success,
    } = req.body || {};

    const teamOid = toObjectId(teamId);
    if (!teamOid) return res.status(400).json({ error: 'teamId is required' });

    const access = await assertTeamAccess(teamOid, req.user.id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

    const statusNum = typeof status === 'number' ? status : Number(status);
    const ok =
      typeof success === 'boolean'
        ? success
        : Number.isFinite(statusNum) && statusNum >= 200 && statusNum < 400;

    const run = await RequestRun.create({
      userId: req.user.id,
      teamId: teamOid,
      projectId: toObjectId(projectId) || undefined,
      requestId: toObjectId(requestId) || undefined,
      name: name || 'Untitled',
      method: method || 'GET',
      protocol: protocol || 'http',
      url: url || '',
      status: Number.isFinite(statusNum) ? statusNum : null,
      statusText: statusText || '',
      responseTimeMs: typeof responseTimeMs === 'number' ? responseTimeMs : null,
      sizeBytes: typeof sizeBytes === 'number' ? sizeBytes : null,
      success: ok,
    });

    logActivity({
      userId: req.user.id,
      teamId: teamOid,
      action: 'execute_request',
      entityId: toObjectId(requestId) || run._id,
      entityType: 'request',
      metadata: {
        name: run.name,
        method: run.method,
        protocol: run.protocol,
        status: run.status,
        responseTimeMs: run.responseTimeMs,
        success: run.success,
      },
    });

    res.status(201).json({ run });
  } catch (err) {
    console.error('[POST /api/dashboard/runs]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
