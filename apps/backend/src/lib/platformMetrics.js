/**
 * In-memory platform metrics: live presence, HTTP load, and traffic windows.
 * Single-process only (fine for current PayloadX deployment).
 */

const WINDOW_MS = 60 * 1000;
const MAX_BUCKETS = 60; // keep ~60 minutes of RPM history

/** @type {Map<string, { userId: string, email?: string, name?: string, section?: string, connectedAt: number, lastSeen: number }>} */
const liveSockets = new Map();

/** Rolling request timestamps (ms) within the last minute for RPM */
const recentRequestTimes = [];

/** Per-minute traffic history: { t: epochMinute, count: number } */
const rpmHistory = [];

let totalRequests = 0;
let totalErrors = 0;
let startedAt = Date.now();

function pruneRecentRequests(now = Date.now()) {
  const cutoff = now - WINDOW_MS;
  while (recentRequestTimes.length && recentRequestTimes[0] < cutoff) {
    recentRequestTimes.shift();
  }
}

function recordRpmBucket(now = Date.now()) {
  const minute = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const last = rpmHistory[rpmHistory.length - 1];
  if (last && last.t === minute) {
    last.count += 1;
  } else {
    rpmHistory.push({ t: minute, count: 1 });
    if (rpmHistory.length > MAX_BUCKETS) rpmHistory.shift();
  }
}

/** Express middleware — count every API hit for load / traffic. */
export function trackHttpMetrics(req, res, next) {
  const now = Date.now();
  totalRequests += 1;
  recentRequestTimes.push(now);
  pruneRecentRequests(now);
  recordRpmBucket(now);

  res.on('finish', () => {
    if (res.statusCode >= 500) totalErrors += 1;
  });

  next();
}

export function registerLiveSocket(socketId, user = {}) {
  const userId = String(user.userId || user.id || user._id || '');
  if (!socketId) return;
  const existing = liveSockets.get(socketId);
  liveSockets.set(socketId, {
    userId: userId || existing?.userId || `anon:${socketId}`,
    email: user.email || existing?.email,
    name: user.name || existing?.name,
    section: user.section || existing?.section || 'unknown',
    connectedAt: existing?.connectedAt || Date.now(),
    lastSeen: Date.now(),
  });
}

export function updateLiveSection(socketId, section) {
  const row = liveSockets.get(socketId);
  if (!row) return;
  row.section = section || row.section;
  row.lastSeen = Date.now();
}

export function unregisterLiveSocket(socketId) {
  liveSockets.delete(socketId);
}

export function getLiveStats() {
  const now = Date.now();
  // Drop stale entries (> 5 min without heartbeat)
  for (const [id, row] of liveSockets.entries()) {
    if (now - row.lastSeen > 5 * 60 * 1000) liveSockets.delete(id);
  }

  const byUser = new Map();
  for (const row of liveSockets.values()) {
    const key = row.userId || row.email || 'anon';
    if (!byUser.has(key)) byUser.set(key, row);
  }

  const sectionCounts = {};
  for (const row of byUser.values()) {
    const sec = row.section || 'unknown';
    sectionCounts[sec] = (sectionCounts[sec] || 0) + 1;
  }

  return {
    liveUsers: byUser.size,
    liveConnections: liveSockets.size,
    bySection: Object.entries(sectionCounts)
      .map(([section, count]) => ({ section, count }))
      .sort((a, b) => b.count - a.count),
    users: Array.from(byUser.values()).map((u) => ({
      userId: u.userId,
      email: u.email || null,
      name: u.name || null,
      section: u.section,
      connectedAt: new Date(u.connectedAt).toISOString(),
    })),
  };
}

export function getLoadStats() {
  const now = Date.now();
  pruneRecentRequests(now);
  const mem = process.memoryUsage();
  return {
    requestsPerMinute: recentRequestTimes.length,
    totalRequests,
    totalErrors,
    uptimeSec: Math.round(process.uptime()),
    startedAt: new Date(startedAt).toISOString(),
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    },
    rpmHistory: rpmHistory.map((b) => ({
      label: new Date(b.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      requests: b.count,
    })),
  };
}
