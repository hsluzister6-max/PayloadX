/**
 * JWT + PayloadX API token authentication
 */

import jwt from 'jsonwebtoken';
import ApiToken, { hashApiToken } from '../../models/ApiToken.js';
import User from '../../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'syncnest-secret-change-in-production';

/**
 * Sign a JWT token
 */
export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Verify a JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Resolve Bearer credential → user payload { id, email, name, authType, apiTokenId? }
 */
export async function resolveAuthToken(rawToken) {
  if (!rawToken) return null;
  const token = String(rawToken).trim();

  // Long-lived API / MCP tokens: pxat_...
  if (token.startsWith('pxat_')) {
    const tokenHash = hashApiToken(token);
    const doc = await ApiToken.findOne({ tokenHash, revokedAt: null }).lean();
    if (!doc) return null;
    if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) return null;

    const user = await User.findById(doc.userId).select('name email').lean();
    if (!user) return null;

    // Fire-and-forget last used
    ApiToken.updateOne({ _id: doc._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});

    return {
      id: String(user._id),
      email: user.email,
      name: user.name,
      authType: 'api_token',
      apiTokenId: String(doc._id),
    };
  }

  const decoded = verifyToken(token);
  if (!decoded) return null;
  return {
    id: decoded.id || decoded._id,
    email: decoded.email,
    name: decoded.name,
    authType: 'jwt',
  };
}

/**
 * Express middleware to authenticate requests
 * Attaches req.user if authenticated, otherwise returns 401
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await resolveAuthToken(authHeader.slice(7));
    if (!user?.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('[authenticate]', err.message);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * Optional auth middleware - attaches req.user if token valid, but doesn't require it
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const user = await resolveAuthToken(authHeader.slice(7));
      if (user) req.user = user;
    }
    next();
  } catch {
    next();
  }
}
