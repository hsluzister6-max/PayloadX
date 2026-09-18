import express from 'express';
import User from '../../models/User.js';
import Team from '../../models/Team.js';
import Project from '../../models/Project.js';
import Request from '../../models/Request.js';
import Collection from '../../models/Collection.js';
import RequestRun from '../../models/RequestRun.js';
import ActivityLog from '../../models/ActivityLog.js';
import AnalyticsEvent from '../../models/AnalyticsEvent.js';
import { authenticate } from '../middleware/auth.js';
import { requirePlatformAdmin } from '../lib/platformAdmin.js';
import { getLiveStats, getLoadStats } from '../lib/platformMetrics.js';

const router = express.Router();

router.use(authenticate, requirePlatformAdmin);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

function dayBuckets(days, fields) {
  const today = startOfDay(new Date());
  const buckets = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = subDays(today, i);
    buckets.push({
      key: formatKey(day),
      label: formatLabel(day, days <= 10),
      ...fields,
    });
  }
  return buckets;
}

/**
 * GET /api/admin/overview
 * Platform-wide analytics for PayloadX admins.
 */
router.get('/overview', async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 14, 7), 90);
    const since = subDays(startOfDay(new Date()), days - 1);
    const todayStart = startOfDay(new Date());

    const [
      totalUsers,
      verifiedUsers,
      newUsersToday,
      usersOverTime,
      totalTeams,
      totalProjects,
      totalCollections,
      totalApis,
      totalRuns,
      runsToday,
      activityToday,
      sectionAgg,
      eventTypeAgg,
      trafficOverTime,
      recentUsers,
      recentEvents,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            signups: { $sum: 1 },
          },
        },
      ]),
      Team.countDocuments(),
      Project.countDocuments(),
      Collection.countDocuments(),
      Request.countDocuments(),
      RequestRun.countDocuments(),
      RequestRun.countDocuments({ createdAt: { $gte: todayStart } }),
      ActivityLog.countDocuments({ createdAt: { $gte: todayStart } }),
      AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { section: '$section', eventType: '$eventType' },
            count: { $sum: 1 },
          },
        },
      ]),
      AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
      ]),
      AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            events: { $sum: 1 },
            views: {
              $sum: { $cond: [{ $eq: ['$eventType', 'view'] }, 1, 0] },
            },
            clicks: {
              $sum: {
                $cond: [
                  { $in: ['$eventType', ['click', 'cta_click']] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      User.find()
        .sort({ createdAt: -1 })
        .limit(12)
        .select('name email avatar isVerified createdAt')
        .lean(),
      AnalyticsEvent.find()
        .sort({ createdAt: -1 })
        .limit(20)
        .select('section eventType target client createdAt userId')
        .lean(),
    ]);

    // Build per-section rollup with CTR
    const sectionMap = {};
    sectionAgg.forEach((row) => {
      const section = row._id.section || 'unknown';
      if (!sectionMap[section]) {
        sectionMap[section] = { section, views: 0, clicks: 0, nav: 0, actions: 0, errors: 0, total: 0 };
      }
      const bucket = sectionMap[section];
      const n = row.count;
      bucket.total += n;
      if (row._id.eventType === 'view') bucket.views += n;
      else if (row._id.eventType === 'click' || row._id.eventType === 'cta_click') bucket.clicks += n;
      else if (row._id.eventType === 'nav') bucket.nav += n;
      else if (row._id.eventType === 'action') bucket.actions += n;
      else if (row._id.eventType === 'error') bucket.errors += n;
    });

    const sectionEvents = Object.values(sectionMap)
      .map((s) => ({
        ...s,
        clickRate: s.views > 0 ? Math.round((s.clicks / s.views) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const totalViews = sectionEvents.reduce((sum, s) => sum + s.views, 0);
    const totalClicks = sectionEvents.reduce((sum, s) => sum + s.clicks, 0);
    const overallCtr = totalViews > 0 ? Math.round((totalClicks / totalViews) * 1000) / 10 : 0;

    const signupBuckets = dayBuckets(days, { signups: 0 });
    const signupIndex = Object.fromEntries(signupBuckets.map((b, i) => [b.key, i]));
    usersOverTime.forEach((row) => {
      const idx = signupIndex[row._id];
      if (idx != null) signupBuckets[idx].signups = row.signups;
    });

    const trafficBuckets = dayBuckets(days, { events: 0, views: 0, clicks: 0 });
    const trafficIndex = Object.fromEntries(trafficBuckets.map((b, i) => [b.key, i]));
    trafficOverTime.forEach((row) => {
      const idx = trafficIndex[row._id];
      if (idx != null) {
        trafficBuckets[idx].events = row.events;
        trafficBuckets[idx].views = row.views;
        trafficBuckets[idx].clicks = row.clicks;
      }
    });

    const live = getLiveStats();
    const load = getLoadStats();

    res.json({
      stats: {
        totalUsers,
        verifiedUsers,
        newUsersToday,
        liveUsers: live.liveUsers,
        liveConnections: live.liveConnections,
        totalTeams,
        totalProjects,
        totalCollections,
        totalApis,
        totalRuns,
        runsToday,
        activityToday,
        totalViews,
        totalClicks,
        clickRate: overallCtr,
        requestsPerMinute: load.requestsPerMinute,
      },
      live,
      load,
      signupsOverTime: signupBuckets.map(({ key, label, signups }) => ({ key, label, signups })),
      trafficOverTime: trafficBuckets.map(({ key, label, events, views, clicks }) => ({
        key,
        label,
        events,
        views,
        clicks,
      })),
      sectionEvents,
      eventTypeBreakdown: eventTypeAgg.map((e) => ({
        name: e._id || 'other',
        value: e.count,
      })),
      recentUsers,
      recentEvents,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/admin/overview]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/live
 * Lightweight live snapshot for polling.
 */
router.get('/live', async (_req, res) => {
  try {
    res.json({
      live: getLiveStats(),
      load: getLoadStats(),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/admin/live]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/users?limit=20&page=1&q=
 */
router.get('/users', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;
    const q = String(req.query.q || '').trim();
    const filter = {};
    if (q) {
      filter.$or = [
        { email: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } },
      ];
    }
    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('name email avatar isVerified createdAt updatedAt')
        .lean(),
      User.countDocuments(filter),
    ]);
    res.json({
      users,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error('[GET /api/admin/users]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
