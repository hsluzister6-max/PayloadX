/**
 * JWT + PayloadX API token authentication
 *
 * Session model:
 * - Short-lived access JWT (default 1h)
 * - Long-lived opaque refresh token (7d / 30d with rememberMe)
 * - Refresh silently renews access; refresh token is only rotated
 *   when it is past halfway through its lifetime (avoids multi-tab races)
 */

import jwt from 'jsonwebtoken';
import ApiToken, { hashApiToken } from '../../models/ApiToken.js';
import RefreshToken, {
  generateRefreshToken,
  hashRefreshToken,
} from '../../models/RefreshToken.js';
import User from '../../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'syncnest-secret-change-in-production';

/** Short-lived access JWT — refreshed silently by the client. */
export const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '1h';
/** Refresh session without "Remember me". */
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Refresh session with "Remember me". */
export const REFRESH_TOKEN_REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Grace window for a just-rotated refresh token (multi-tab race). */
const REFRESH_REUSE_GRACE_MS = 30_000;

/**
 * Sign a short-lived access JWT
 */
export function signToken(payload, expiresIn = ACCESS_TOKEN_TTL) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
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

function accessExpiresInSeconds() {
  const ttl = String(ACCESS_TOKEN_TTL).trim();
  const match = ttl.match(/^(\d+)([smhd])$/i);
  if (!match) return 3600;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 's') return n;
  if (unit === 'm') return n * 60;
  if (unit === 'h') return n * 3600;
  if (unit === 'd') return n * 86400;
  return 3600;
}

function signAccessForUser(user) {
  return signToken({
    id: user._id,
    email: user.email,
    name: user.name,
  });
}

/**
 * Issue access + refresh tokens for a user session.
 * @param {{ _id: any, email: string, name: string }} user
 * @param {{ rememberMe?: boolean, userAgent?: string }} [options]
 */
export async function issueAuthSession(user, options = {}) {
  const rememberMe = Boolean(options.rememberMe);
  const accessToken = signAccessForUser(user);

  const { raw, hash, prefix } = generateRefreshToken();
  const ttlMs = rememberMe ? REFRESH_TOKEN_REMEMBER_TTL_MS : REFRESH_TOKEN_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs);

  await RefreshToken.create({
    userId: user._id,
    tokenHash: hash,
    tokenPrefix: prefix,
    rememberMe,
    expiresAt,
    userAgent: String(options.userAgent || '').slice(0, 300),
  });

  return {
    token: accessToken,
    refreshToken: raw,
    expiresIn: accessExpiresInSeconds(),
    rememberMe,
  };
}

/**
 * Renew session from a refresh token.
 * Normally keeps the same refresh token and only mints a new access JWT.
 * Rotates the refresh token only when it is past halfway through its TTL.
 *
 * @returns {Promise<{
 *   token: string,
 *   refreshToken: string,
 *   expiresIn: number,
 *   rememberMe: boolean,
 *   user: any
 * } | null>}
 */
export async function rotateRefreshToken(rawRefreshToken, options = {}) {
  if (!rawRefreshToken) return null;
  const hash = hashRefreshToken(rawRefreshToken);

  let existing = await RefreshToken.findOne({ tokenHash: hash });
  if (!existing) return null;

  // Multi-tab race: a just-rotated token was presented again within grace.
  // Issue a fresh access token for the same user instead of forcing logout.
  if (existing.revokedAt) {
    const revokedAge = Date.now() - new Date(existing.revokedAt).getTime();
    if (revokedAge <= REFRESH_REUSE_GRACE_MS) {
      const user = await User.findById(existing.userId);
      if (!user) return null;
      return {
        token: signAccessForUser(user),
        refreshToken: rawRefreshToken,
        expiresIn: accessExpiresInSeconds(),
        rememberMe: Boolean(existing.rememberMe),
        user: user.toSafeObject(),
        reused: true,
      };
    }
    return null;
  }

  if (existing.expiresAt && existing.expiresAt < new Date()) {
    existing.revokedAt = new Date();
    await existing.save();
    return null;
  }

  const user = await User.findById(existing.userId);
  if (!user) {
    existing.revokedAt = new Date();
    await existing.save();
    return null;
  }

  const createdAt = existing.createdAt ? new Date(existing.createdAt).getTime() : Date.now();
  const expiresAt = existing.expiresAt ? new Date(existing.expiresAt).getTime() : createdAt;
  const lifetime = Math.max(expiresAt - createdAt, 1);
  const age = Date.now() - createdAt;
  const shouldRotateRefresh = age >= lifetime * 0.5;

  existing.lastUsedAt = new Date();

  // Common path: keep refresh token, only mint new access JWT
  if (!shouldRotateRefresh) {
    await existing.save();
    return {
      token: signAccessForUser(user),
      refreshToken: rawRefreshToken,
      expiresIn: accessExpiresInSeconds(),
      rememberMe: Boolean(existing.rememberMe),
      user: user.toSafeObject(),
    };
  }

  // Mid-life rotation: issue a new refresh token and revoke the old one
  const session = await issueAuthSession(user, {
    rememberMe: existing.rememberMe,
    userAgent: options.userAgent || existing.userAgent,
  });

  existing.revokedAt = new Date();
  existing.replacedByHash = hashRefreshToken(session.refreshToken);
  await existing.save();

  return {
    ...session,
    user: user.toSafeObject(),
  };
}

/** Revoke a single refresh token (logout this device). */
export async function revokeRefreshToken(rawRefreshToken) {
  if (!rawRefreshToken) return;
  const hash = hashRefreshToken(rawRefreshToken);
  await RefreshToken.updateOne(
    { tokenHash: hash, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
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
      return res.status(401).json({ error: 'Unauthorized', code: 'ACCESS_MISSING' });
    }

    const user = await resolveAuthToken(authHeader.slice(7));
    if (!user?.id) {
      return res.status(401).json({ error: 'Invalid token', code: 'ACCESS_INVALID' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('[authenticate]', err.message);
    return res.status(401).json({ error: 'Unauthorized', code: 'ACCESS_INVALID' });
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
