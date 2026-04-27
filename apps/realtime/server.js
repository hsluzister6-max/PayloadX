'use strict';
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '4000', 10);
const RAW_CORS = process.env.CORS_ORIGIN || '*';
// If wildcard, keep as string '*'; otherwise split into array
const CORS_ORIGIN = RAW_CORS === '*' ? '*' : RAW_CORS.split(',').map((o) => o.trim());
// Credentials cannot be true when origin is '*' (browser enforced)
const CORS_CREDENTIALS = CORS_ORIGIN !== '*';


// ───────────────────
// ──────────────────────────────────────────────────────────
// Express + HTTP server
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

app.use(cors({ origin: CORS_ORIGIN, credentials: CORS_CREDENTIALS }));
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// In-memory state
// roomMembers     : Map<room, Map<socketId, user>>
// requestViewers  : Map<requestId, Map<socketId, user>>
// socketMeta      : Map<socketId, { teamId?, openRequestId? }> — for cleanup
// ─────────────────────────────────────────────────────────────────────────────
const roomMembers = new Map();
const requestViewers = new Map();
const apiDocViewers = new Map();
const socketMeta = new Map(); // Map<socketId, { teamId?, openRequestId?, openApiDocId? }>

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getMembers(room) {
  return roomMembers.has(room) ? Array.from(roomMembers.get(room).values()) : [];
}

function getViewers(requestId) {
  return requestViewers.has(requestId)
    ? Array.from(requestViewers.get(requestId).values())
    : [];
}

function getApiDocViewers(endpointId) {
  return apiDocViewers.has(endpointId)
    ? Array.from(apiDocViewers.get(endpointId).values())
    : [];
}

function log(event, ...args) {
  console.log(`[${new Date().toISOString()}] [${event}]`, ...args);
}

// ─────────────────────────────────────────────────────────────────────────────
// Socket.IO
// ─────────────────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: CORS_CREDENTIALS,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'], // WebSocket first, polling fallback
});

io.on('connection', (socket) => {
  log('connect', `socket=${socket.id}`);
  socketMeta.set(socket.id, {});

  // ── 1. TEAM ROOM ────────────────────────────────────────────────────────────
  socket.on('join_team', ({ teamId, user } = {}) => {
    if (!teamId) return;
    const room = `team:${teamId}`;
    socket.join(room);

    if (!roomMembers.has(room)) roomMembers.set(room, new Map());
    roomMembers.get(room).set(socket.id, { ...user, socketId: socket.id });

    // Store meta for disconnect cleanup
    const meta = socketMeta.get(socket.id) || {};
    socketMeta.set(socket.id, { ...meta, teamId, room });

    const members = getMembers(room);
    socket.to(room).emit('member_joined', { user, members });
    socket.emit('room_members', { members });

    log('join_team', `user=${user?.name || socket.id} room=${room} total=${members.length}`);
  });

  socket.on('leave_team', ({ teamId } = {}) => {
    if (!teamId) return;
    const room = `team:${teamId}`;
    socket.leave(room);
    if (roomMembers.has(room)) {
      roomMembers.get(room).delete(socket.id);
      const members = getMembers(room);
      socket.to(room).emit('member_left', { socketId: socket.id, members });
      log('leave_team', `socket=${socket.id} room=${room} remaining=${members.length}`);
    }
  });

  socket.on("message", (data) => {
    console.log("message", data);
  })

  // ── 2. PRESENCE: Who is viewing a specific request ──────────────────────────
  socket.on('open_request', ({ teamId, requestId, user } = {}) => {
    if (!requestId || !teamId) return;

    if (!requestViewers.has(requestId)) requestViewers.set(requestId, new Map());
    requestViewers.get(requestId).set(socket.id, { ...user, socketId: socket.id });

    const meta = socketMeta.get(socket.id) || {};
    socketMeta.set(socket.id, { ...meta, openRequestId: requestId, teamId });

    const viewers = getViewers(requestId);
    io.to(`team:${teamId}`).emit('request_viewers_updated', { requestId, viewers });
    log('open_request', `requestId=${requestId} viewers=${viewers.length}`);
  });

  socket.on('close_request', ({ teamId, requestId } = {}) => {
    if (!requestId) return;
    if (requestViewers.has(requestId)) {
      requestViewers.get(requestId).delete(socket.id);
      const viewers = getViewers(requestId);
      if (teamId) io.to(`team:${teamId}`).emit('request_viewers_updated', { requestId, viewers });
    }
    const meta = socketMeta.get(socket.id) || {};
    socketMeta.set(socket.id, { ...meta, openRequestId: null });
    log('close_request', `requestId=${requestId}`);
  });

  // ── 2b. PRESENCE: Who is viewing a specific API Doc endpoint ────────────────
  socket.on('open_apidoc', ({ teamId, endpointId, user } = {}) => {
    if (!endpointId || !teamId) return;

    if (!apiDocViewers.has(endpointId)) apiDocViewers.set(endpointId, new Map());
    apiDocViewers.get(endpointId).set(socket.id, { ...user, socketId: socket.id });

    const meta = socketMeta.get(socket.id) || {};
    socketMeta.set(socket.id, { ...meta, openApiDocId: endpointId, teamId });

    const viewers = getApiDocViewers(endpointId);
    io.to(`team:${teamId}`).emit('apidoc_viewers_updated', { endpointId, viewers });
    log('open_apidoc', `endpointId=${endpointId} viewers=${viewers.length}`);
  });

  socket.on('close_apidoc', ({ teamId, endpointId } = {}) => {
    if (!endpointId) return;
    if (apiDocViewers.has(endpointId)) {
      apiDocViewers.get(endpointId).delete(socket.id);
      const viewers = getApiDocViewers(endpointId);
      if (teamId) io.to(`team:${teamId}`).emit('apidoc_viewers_updated', { endpointId, viewers });
    }
    const meta = socketMeta.get(socket.id) || {};
    socketMeta.set(socket.id, { ...meta, openApiDocId: null });
    log('close_apidoc', `endpointId=${endpointId}`);
  });

  // ── 3. REQUEST EVENTS ───────────────────────────────────────────────────────
  socket.on('create_request', ({ teamId, request, userId } = {}) => {
    if (!teamId || !request) return;
    socket.to(`team:${teamId}`).emit('request_created', { request, userId, timestamp: Date.now() });
    log('create_request', `teamId=${teamId} userId=${userId}`);
  });

  socket.on('update_request', ({ teamId, request, userId } = {}) => {
    if (!teamId || !request) return;
    socket.to(`team:${teamId}`).emit('request_updated', { request, userId, timestamp: Date.now() });
    log('update_request', `teamId=${teamId} requestId=${request._id}`);
  });

  socket.on('delete_request', ({ teamId, collectionId, requestId, userId } = {}) => {
    if (!teamId || !requestId) return;
    socket.to(`team:${teamId}`).emit('request_deleted', {
      collectionId, requestId, userId, timestamp: Date.now(),
    });
    log('delete_request', `teamId=${teamId} requestId=${requestId}`);
  });

  // ── 4. COLLECTION EVENTS ─────────────────────────────────────────────────────
  socket.on('create_collection', ({ teamId, collection, userId } = {}) => {
    if (!teamId || !collection) return;
    socket.to(`team:${teamId}`).emit('collection_created', { collection, userId, timestamp: Date.now() });
    log('create_collection', `teamId=${teamId}`);
  });

  socket.on('update_collection', ({ teamId, collection, userId } = {}) => {
    if (!teamId || !collection) return;
    socket.to(`team:${teamId}`).emit('collection_updated', { collection, userId, timestamp: Date.now() });
    log('update_collection', `teamId=${teamId}`);
  });

  socket.on('delete_collection', ({ teamId, collectionId, userId } = {}) => {
    if (!teamId || !collectionId) return;
    socket.to(`team:${teamId}`).emit('collection_deleted', { collectionId, userId, timestamp: Date.now() });
    log('delete_collection', `teamId=${teamId} collectionId=${collectionId}`);
  });

  socket.on('import_collection', ({ teamId, collection, requestCount, userId } = {}) => {
    if (!teamId || !collection) return;
    socket.to(`team:${teamId}`).emit('collection_imported', {
      collection, requestCount, userId, timestamp: Date.now(),
    });
    log('import_collection', `teamId=${teamId} collection=${collection.name}`);
  });

  // ── 5. PROJECT EVENTS ────────────────────────────────────────────────────────
  socket.on('create_project', ({ teamId, project, userId } = {}) => {
    if (!teamId || !project) return;
    socket.to(`team:${teamId}`).emit('project_created', { project, userId, timestamp: Date.now() });
    log('create_project', `teamId=${teamId}`);
  });

  socket.on('update_project', ({ teamId, project, userId } = {}) => {
    if (!teamId || !project) return;
    socket.to(`team:${teamId}`).emit('project_updated', { project, userId, timestamp: Date.now() });
    log('update_project', `teamId=${teamId}`);
  });

  socket.on('delete_project', ({ teamId, projectId, userId } = {}) => {
    if (!teamId || !projectId) return;
    socket.to(`team:${teamId}`).emit('project_deleted', { projectId, userId, timestamp: Date.now() });
    log('delete_project', `teamId=${teamId} projectId=${projectId}`);
  });

  // ── 6. TEAM EVENTS ───────────────────────────────────────────────────────────
  socket.on('update_team', ({ teamId, team, userId } = {}) => {
    if (!teamId || !team) return;
    socket.to(`team:${teamId}`).emit('team_updated', { team, userId, timestamp: Date.now() });
    log('update_team', `teamId=${teamId}`);
  });

  socket.on('delete_team', ({ teamId, userId } = {}) => {
    if (!teamId) return;
    socket.to(`team:${teamId}`).emit('team_deleted', { teamId, userId, timestamp: Date.now() });
    log('delete_team', `teamId=${teamId}`);
  });

  // New member invited / removed events
  socket.on('member_invited', ({ teamId, invitedUser, userId } = {}) => {
    if (!teamId || !invitedUser) return;
    socket.to(`team:${teamId}`).emit('team_member_invited', { invitedUser, userId, timestamp: Date.now() });
    log('member_invited', `teamId=${teamId}`);
  });

  socket.on('member_removed', ({ teamId, removedUserId, userId } = {}) => {
    if (!teamId || !removedUserId) return;
    socket.to(`team:${teamId}`).emit('team_member_removed', { removedUserId, userId, timestamp: Date.now() });
    log('member_removed', `teamId=${teamId} removed=${removedUserId}`);
  });

  // ── 7. API DOC EVENTS ────────────────────────────────────────────────────────
  socket.on('create_apidoc', ({ teamId, doc, userId } = {}) => {
    if (!teamId || !doc) return;
    socket.to(`team:${teamId}`).emit('apidoc_created', { doc, userId, timestamp: Date.now() });
    log('create_apidoc', `teamId=${teamId}`);
  });

  socket.on('update_apidoc', ({ teamId, doc, userId } = {}) => {
    if (!teamId || !doc) return;
    socket.to(`team:${teamId}`).emit('apidoc_updated', { doc, userId, timestamp: Date.now() });
    log('update_apidoc', `teamId=${teamId}`);
  });

  socket.on('delete_apidoc', ({ teamId, docId, userId } = {}) => {
    if (!teamId || !docId) return;
    socket.to(`team:${teamId}`).emit('apidoc_deleted', { docId, userId, timestamp: Date.now() });
    log('delete_apidoc', `teamId=${teamId} docId=${docId}`);
  });

  // ── 8. TYPING INDICATORS ─────────────────────────────────────────────────────
  socket.on('typing_start', ({ teamId, requestId, userId } = {}) => {
    if (!teamId) return;
    socket.to(`team:${teamId}`).emit('user_typing', { requestId, userId });
  });

  socket.on('typing_stop', ({ teamId, requestId, userId } = {}) => {
    if (!teamId) return;
    socket.to(`team:${teamId}`).emit('user_stopped_typing', { requestId, userId });
  });

  socket.on('apidoc_typing_start', ({ teamId, docId, endpointId, userId } = {}) => {
    if (!teamId) return;
    socket.to(`team:${teamId}`).emit('apidoc_user_typing', { docId, endpointId, userId });
  });

  socket.on('apidoc_typing_stop', ({ teamId, docId, endpointId, userId } = {}) => {
    if (!teamId) return;
    socket.to(`team:${teamId}`).emit('apidoc_user_stopped_typing', { docId, endpointId, userId });
  });

  // ── 9. CURSOR / LIVE PRESENCE ────────────────────────────────────────────────
  socket.on('cursor_update', ({ teamId, requestId, userId, cursor } = {}) => {
    if (!teamId) return;
    socket.to(`team:${teamId}`).emit('cursor_updated', { requestId, userId, cursor });
  });

  // ── 10. ENVIRONMENT EVENTS ───────────────────────────────────────────────────
  socket.on('create_environment', ({ teamId, environment, userId } = {}) => {
    if (!teamId || !environment) return;
    socket.to(`team:${teamId}`).emit('environment_created', { environment, userId, timestamp: Date.now() });
    log('create_environment', `teamId=${teamId}`);
  });

  socket.on('update_environment', ({ teamId, environment, userId } = {}) => {
    if (!teamId || !environment) return;
    socket.to(`team:${teamId}`).emit('environment_updated', { environment, userId, timestamp: Date.now() });
    log('update_environment', `teamId=${teamId}`);
  });

  socket.on('delete_environment', ({ teamId, environmentId, userId } = {}) => {
    if (!teamId || !environmentId) return;
    socket.to(`team:${teamId}`).emit('environment_deleted', { environmentId, userId, timestamp: Date.now() });
    log('delete_environment', `teamId=${teamId} environmentId=${environmentId}`);
  });

  // ── 11. DISCONNECT ───────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    log('disconnect', `socket=${socket.id} reason=${reason}`);

    const meta = socketMeta.get(socket.id) || {};

    // Remove from all team rooms
    for (const [room, members] of roomMembers.entries()) {
      if (members.has(socket.id)) {
        members.delete(socket.id);
        const remaining = Array.from(members.values());
        io.to(room).emit('member_left', { socketId: socket.id, members: remaining });
        log('cleanup', `removed ${socket.id} from ${room} remaining=${remaining.length}`);
      }
    }

    // Remove from request viewers
    const openRequestId = meta.openRequestId;
    if (openRequestId && requestViewers.has(openRequestId)) {
      requestViewers.get(openRequestId).delete(socket.id);
      const viewers = getViewers(openRequestId);
      // Broadcast to all team rooms since teamId might be stale
      for (const [room] of roomMembers.entries()) {
        io.to(room).emit('request_viewers_updated', { requestId: openRequestId, viewers });
      }
    }

    // Remove from api doc viewers
    const openApiDocId = meta.openApiDocId;
    if (openApiDocId && apiDocViewers.has(openApiDocId)) {
      apiDocViewers.get(openApiDocId).delete(socket.id);
      const viewers = getApiDocViewers(openApiDocId);
      for (const [room] of roomMembers.entries()) {
        io.to(room).emit('apidoc_viewers_updated', { endpointId: openApiDocId, viewers });
      }
    }

    socketMeta.delete(socket.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REST endpoints (Render health check + monitoring)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ service: 'PayloadX Realtime Server', status: 'ok' });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    connections: io.engine.clientsCount,
    rooms: roomMembers.size,
    timestamp: new Date().toISOString(),
  });
});

app.get('/rooms', (_req, res) => {
  const rooms = {};
  for (const [room, members] of roomMembers.entries()) {
    rooms[room] = members.size;
  }
  res.json({ rooms, total: roomMembers.size });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🔌 PayloadX Realtime Server`);
  console.log(`   Port     : ${PORT}`);
  console.log(`   CORS     : ${Array.isArray(CORS_ORIGIN) ? CORS_ORIGIN.join(', ') : CORS_ORIGIN}`);
  console.log(`   Mode     : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health   : http://localhost:${PORT}/health\n`);

  // ── Keep-alive self-ping (prevents Render free tier from sleeping) ──────────
  // Runs in ALL environments so you can verify it locally before deploying.
  // On Render, set RENDER_EXTERNAL_URL to your public service URL.
  const SELF_URL = process.env.RENDER_EXTERNAL_URL
    ? `${process.env.RENDER_EXTERNAL_URL}/health`
    : `http://localhost:${PORT}/health`;

  const PING_INTERVAL_MS = 30_000; // 30 seconds

  setInterval(async () => {
    try {
      const res = await fetch(SELF_URL);
      const env = process.env.NODE_ENV || 'development';
      console.log(`[${new Date().toISOString()}] [keep-alive] ✅ pinged ${SELF_URL} → HTTP ${res.status} (${env})`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] [keep-alive] ❌ ping failed: ${err.message}`);
    }
  }, PING_INTERVAL_MS);

  console.log(`⏰ Keep-alive cron started — pinging ${SELF_URL} every ${PING_INTERVAL_MS / 1000}s\n`);
});

module.exports = { app, server, io };
