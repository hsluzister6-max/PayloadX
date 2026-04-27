// server.js — Custom Next.js server with Socket.IO embedded on port 3001
'use strict';

require('dotenv').config({ path: '.env' });

const http = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const PORT = parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

// ── Track presence ────────────────────────────────────────────────────────────
// roomMembers: room key → Map<socketId, user>
const roomMembers = new Map();
// requestViewers: requestId → Map<socketId, user>
const requestViewers = new Map();

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url, true);

    // CORS headers for desktop app / browser support
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    handle(req, res, parsedUrl);
  });

  // ── Attach Socket.IO ───────────────────────────────────────────────────────
  const io = new Server(server, {
    cors: {
      origin: CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // ── JOIN TEAM ROOM ───────────────────────────────────────────────────────
    socket.on('join_team', ({ teamId, user }) => {
      if (!teamId) return;
      const room = `team:${teamId}`;
      socket.join(room);

      if (!roomMembers.has(room)) roomMembers.set(room, new Map());
      roomMembers.get(room).set(socket.id, { ...user, socketId: socket.id });

      const members = Array.from(roomMembers.get(room).values());
      socket.to(room).emit('member_joined', { user, members });
      socket.emit('room_members', { members });

      // Send current request presence state to the joining user
      const currentPresence = {};
      for (const [reqId, viewersMap] of requestViewers.entries()) {
        if (viewersMap.size > 0) {
          currentPresence[reqId] = Array.from(viewersMap.values());
        }
      }
      socket.emit('request_viewers_bulk', { presence: currentPresence });

      console.log(`[Socket] ${user?.name || socket.id} joined ${room}`);
    });

    // ── LEAVE TEAM ROOM ──────────────────────────────────────────────────────
    socket.on('leave_team', ({ teamId }) => {
      const room = `team:${teamId}`;
      socket.leave(room);
      if (roomMembers.has(room)) {
        roomMembers.get(room).delete(socket.id);
        const members = Array.from(roomMembers.get(room).values());
        socket.to(room).emit('member_left', { socketId: socket.id, members });
      }
    });

    // ── PRESENCE: open / close request ──────────────────────────────────────
    socket.on('open_request', ({ teamId, requestId, user }) => {
      if (!requestId || !teamId) return;

      // Store who is viewing this requestId
      if (!requestViewers.has(requestId)) requestViewers.set(requestId, new Map());
      requestViewers.get(requestId).set(socket.id, { ...user, socketId: socket.id });

      // Track which requestId this socket has open (for cleanup on disconnect)
      socket._openRequestId = requestId;

      const viewers = Array.from(requestViewers.get(requestId).values());
      // Broadcast to the whole team room (including sender so their own UI updates)
      io.to(`team:${teamId}`).emit('request_viewers_updated', { requestId, viewers });
    });

    socket.on('close_request', ({ teamId, requestId, userId }) => {
      if (!requestId) return;
      if (requestViewers.has(requestId)) {
        requestViewers.get(requestId).delete(socket.id);
        const viewers = Array.from(requestViewers.get(requestId).values());
        if (teamId) {
          io.to(`team:${teamId}`).emit('request_viewers_updated', { requestId, viewers });
        }
      }
      socket._openRequestId = null;
    });

    // ── REQUEST EVENTS ───────────────────────────────────────────────────────
    socket.on('create_request', ({ teamId, request, userId }) => {
      if (!teamId || !request) return;
      socket.to(`team:${teamId}`).emit('request_created', { request, userId, timestamp: Date.now() });
    });

    socket.on('update_request', ({ teamId, request, userId }) => {
      if (!teamId || !request) return;
      socket.to(`team:${teamId}`).emit('request_updated', { request, userId, timestamp: Date.now() });
    });

    socket.on('delete_request', ({ teamId, collectionId, requestId, userId }) => {
      if (!teamId || !requestId) return;
      socket.to(`team:${teamId}`).emit('request_deleted', { collectionId, requestId, userId, timestamp: Date.now() });
    });

    // ── COLLECTION EVENTS ────────────────────────────────────────────────────
    socket.on('create_collection', ({ teamId, collection, userId }) => {
      if (!teamId || !collection) return;
      socket.to(`team:${teamId}`).emit('collection_created', { collection, userId, timestamp: Date.now() });
    });

    socket.on('update_collection', ({ teamId, collection, userId }) => {
      if (!teamId || !collection) return;
      socket.to(`team:${teamId}`).emit('collection_updated', { collection, userId, timestamp: Date.now() });
    });

    socket.on('delete_collection', ({ teamId, collectionId, userId }) => {
      if (!teamId || !collectionId) return;
      socket.to(`team:${teamId}`).emit('collection_deleted', { collectionId, userId, timestamp: Date.now() });
    });

    socket.on('import_collection', ({ teamId, collection, requestCount, userId }) => {
      if (!teamId || !collection) return;
      socket.to(`team:${teamId}`).emit('collection_imported', { collection, requestCount, userId, timestamp: Date.now() });
    });

    // ── PROJECT EVENTS ───────────────────────────────────────────────────────
    socket.on('create_project', ({ teamId, project, userId }) => {
      if (!teamId || !project) return;
      socket.to(`team:${teamId}`).emit('project_created', { project, userId, timestamp: Date.now() });
    });

    socket.on('update_project', ({ teamId, project, userId }) => {
      if (!teamId || !project) return;
      socket.to(`team:${teamId}`).emit('project_updated', { project, userId, timestamp: Date.now() });
    });

    socket.on('delete_project', ({ teamId, projectId, userId }) => {
      if (!teamId || !projectId) return;
      socket.to(`team:${teamId}`).emit('project_deleted', { projectId, userId, timestamp: Date.now() });
    });

    // ── TEAM EVENTS ──────────────────────────────────────────────────────────
    socket.on('update_team', ({ teamId, team, userId }) => {
      if (!teamId || !team) return;
      socket.to(`team:${teamId}`).emit('team_updated', { team, userId, timestamp: Date.now() });
    });

    socket.on('delete_team', ({ teamId, userId }) => {
      if (!teamId) return;
      socket.to(`team:${teamId}`).emit('team_deleted', { teamId, userId, timestamp: Date.now() });
    });

    // ── WORKFLOW EVENTS ──────────────────────────────────────────────────────
    socket.on('create_workflow', ({ teamId, workflow, userId }) => {
      if (!teamId || !workflow) return;
      socket.to(`team:${teamId}`).emit('workflow_created', { workflow, userId, timestamp: Date.now() });
    });

    socket.on('update_workflow', ({ teamId, workflow, userId }) => {
      if (!teamId || !workflow) return;
      socket.to(`team:${teamId}`).emit('workflow_updated', { workflow, userId, timestamp: Date.now() });
    });

    socket.on('delete_workflow', ({ teamId, workflowId, userId }) => {
      if (!teamId || !workflowId) return;
      socket.to(`team:${teamId}`).emit('workflow_deleted', { workflowId, userId, timestamp: Date.now() });
    });

    // ── API DOC EVENTS ───────────────────────────────────────────────────────
    socket.on('update_apidoc', ({ teamId, doc, userId }) => {
      if (!teamId || !doc) return;
      socket.to(`team:${teamId}`).emit('apidoc_updated', { doc, userId, timestamp: Date.now() });
    });

    socket.on('apidoc_typing_start', ({ teamId, docId, endpointId, userId }) => {
      socket.to(`team:${teamId}`).emit('apidoc_user_typing', { docId, endpointId, userId });
    });

    socket.on('apidoc_typing_stop', ({ teamId, docId, endpointId, userId }) => {
      socket.to(`team:${teamId}`).emit('apidoc_user_stopped_typing', { docId, endpointId, userId });
    });

    // ── TYPING INDICATORS ────────────────────────────────────────────────────
    socket.on('typing_start', ({ teamId, requestId, userId }) => {
      socket.to(`team:${teamId}`).emit('user_typing', { requestId, userId });
    });

    socket.on('typing_stop', ({ teamId, requestId, userId }) => {
      socket.to(`team:${teamId}`).emit('user_stopped_typing', { requestId, userId });
    });

    // ── CURSOR / PRESENCE ────────────────────────────────────────────────────
    socket.on('cursor_update', ({ teamId, requestId, userId, cursor }) => {
      socket.to(`team:${teamId}`).emit('cursor_updated', { requestId, userId, cursor });
    });

    // ── DISCONNECT ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);

      // Clean from all team rooms
      for (const [room, members] of roomMembers.entries()) {
        if (members.has(socket.id)) {
          members.delete(socket.id);
          const remaining = Array.from(members.values());
          io.to(room).emit('member_left', { socketId: socket.id, members: remaining });
        }
      }

      // Clean from any open request
      if (socket._openRequestId) {
        const requestId = socket._openRequestId;
        if (requestViewers.has(requestId)) {
          requestViewers.get(requestId).delete(socket.id);
          const viewers = Array.from(requestViewers.get(requestId).values());
          // Broadcast to all rooms (we don't reliably know teamId on disconnect)
          for (const [room] of roomMembers.entries()) {
            io.to(room).emit('request_viewers_updated', { requestId, viewers });
          }
        }
      }
    });
  });

  // ── Health / info endpoints ──────────────────────────────────────────────
  // Note: these are handled BEFORE Next.js via the http handler above.
  // For simplicity we inject them via a socket.io middleware no-op;
  // they live at /health and /rooms but Next.js will 404 them unless
  // we handle them in the http.createServer callback:
  server.on('request', (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        uptime: process.uptime(),
        connections: io.engine.clientsCount,
        timestamp: new Date().toISOString(),
      }));
    }
  });

  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`🚀 PayloadX backend + Socket.IO running on http://localhost:${PORT}`);
    console.log(`   Mode: ${dev ? 'development' : 'production'}`);
    console.log(`   CORS origin: ${CORS_ORIGIN}`);
  });
});
