/**
 * PayloadX Express API Server
 * Replaces Next.js App Router with Express.js
 */

import 'dotenv/config';

import express from 'express';
import http from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const app = express();
const server = http.createServer(app);

const PORT = parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI environment variable is required');
  process.exit(1);
}

// ── Database Connection ───────────────────────────────────────────────────
let cachedPromise = null;

async function connectDB() {
  if (cachedPromise) return cachedPromise;

  cachedPromise = mongoose.connect(MONGODB_URI, {
    bufferCommands: true,
    maxPoolSize: 10,
  }).then((conn) => {
    console.log('✅ MongoDB connected');
    return conn;
  }).catch((error) => {
    cachedPromise = null;
    console.error('❌ MongoDB connection error:', error.message);
    throw error;
  });

  return cachedPromise;
}

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Attach DB to requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// ── Swagger Configuration ──────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PayloadX API',
      version: '1.0.0',
      description: 'The internal API for PayloadX - Unified API Studio and Workflow Engine',
      contact: {
        name: 'PayloadX Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Local development server',
      },
    ],
  },
  apis: ['./src/routes/*.js'], // Path to the API docs
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// ── Routes ──────────────────────────────────────────────────────────────────
import authRoutes from './routes/auth.js';
import requestRoutes from './routes/request.js';
import collectionRoutes from './routes/collection.js';
import projectRoutes from './routes/project.js';
import teamRoutes from './routes/team.js';
import environmentRoutes from './routes/environment.js';
import apidocRoutes from './routes/apidoc.js';
import importRoutes from './routes/import.js';
import commentRoutes from './routes/comment.js';
import workflowRoutes from './routes/workflow.js';
import workflowExecutionRoutes from './routes/workflowExecution.js';

app.use('/api/auth', authRoutes);
app.use('/api/request', requestRoutes);
app.use('/api/collection', collectionRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/environment', environmentRoutes);
app.use('/api/apidoc', apidocRoutes);
app.use('/api/import', importRoutes);
app.use('/api/comment', commentRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/workflow-execution', workflowExecutionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Vercel Cron Job Route (Keep-Alive)
app.get('/api/cron', (req, res) => {
  console.log(`[cron] ✅ Server keep-alive ping received at ${new Date().toISOString()}`);
  res.status(200).json({
    status: 'ok',
    message: 'Cron job executed successfully',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Socket.IO ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Track presence
const roomMembers = new Map();
const requestViewers = new Map();

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

    if (!requestViewers.has(requestId)) requestViewers.set(requestId, new Map());
    requestViewers.get(requestId).set(socket.id, { ...user, socketId: socket.id });

    socket._openRequestId = requestId;

    const viewers = Array.from(requestViewers.get(requestId).values());
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

  // ── COLLECTION EVENTS ──────────────────────────────────────────────────────
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
        for (const [room] of roomMembers.entries()) {
          io.to(room).emit('request_viewers_updated', { requestId, viewers });
        }
      }
    }
  });
});

// ── Keep-Alive Ping (for Render free tier) ─────────────────────────────────
// Prevents the server from going to sleep on free hosting
const SELF_URL = process.env.SELF_URL || `http://localhost:${PORT}`;
const KEEP_ALIVE_INTERVAL = 30 * 1000; // 30 seconds

if (process.env.ENABLE_KEEP_ALIVE === 'true' || SELF_URL.includes('onrender.com')) {
  setInterval(async () => {
    try {
      const response = await fetch(`${SELF_URL}/health`);
      if (response.ok) {
        console.log(`[keep-alive] ✅ Server pinged successfully at ${new Date().toISOString()}`);
      } else {
        console.log(`[keep-alive] ⚠️ Server returned ${response.status}`);
      }
    } catch (error) {
      console.log(`[keep-alive] ❌ Ping failed: ${error.message}`);
    }
  }, KEEP_ALIVE_INTERVAL);

  console.log(`[keep-alive] Enabled - pinging every 30s to keep Render free tier awake`);
}

// ── Start Server ────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`🚀 PayloadX Express API + Socket.IO running on http://localhost:${PORT}`);
    console.log(`   CORS origin: ${CORS_ORIGIN}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
  });
}

export default app;
