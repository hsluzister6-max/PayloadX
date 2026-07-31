import mongoose from 'mongoose';
import crypto from 'crypto';

const ENC_ALGO = 'aes-256-gcm';

function encryptionKey() {
  const secret = process.env.JWT_SECRET || 'syncnest-secret-change-in-production';
  return crypto.createHash('sha256').update(secret).digest();
}

/** Encrypt raw token so it can be revealed later from Account page. */
export function encryptApiToken(rawToken) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGO, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(rawToken), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/** Decrypt stored token ciphertext. Returns null if missing/invalid. */
export function decryptApiToken(payload) {
  if (!payload || typeof payload !== 'string') return null;
  try {
    const [ivB64, tagB64, dataB64] = payload.split(':');
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv(ENC_ALGO, encryptionKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

const ApiTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      default: 'MCP Token',
    },
    /** First chars for UI display, e.g. pxat_abcd… */
    tokenPrefix: {
      type: String,
      required: true,
    },
    /** SHA-256 hash of full token (auth lookup) */
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    /** AES-GCM ciphertext so owner can reveal token + MCP config later */
    tokenEncrypted: {
      type: String,
      default: null,
      select: false,
    },
    scopes: {
      type: [String],
      default: ['mcp', 'api'],
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    /** null = never expires; stays valid until revoked from Account page */
    expiresAt: {
      type: Date,
      default: null,
    },
    /** Set when user revokes from dashboard — token stops working immediately */
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

ApiTokenSchema.index({ userId: 1, revokedAt: 1, createdAt: -1 });

export function hashApiToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

export function generateApiToken() {
  const secret = crypto.randomBytes(32).toString('base64url');
  const raw = `pxat_${secret}`;
  return {
    raw,
    prefix: `${raw.slice(0, 12)}…`,
    hash: hashApiToken(raw),
    encrypted: encryptApiToken(raw),
  };
}

export default mongoose.models.ApiToken || mongoose.model('ApiToken', ApiTokenSchema);
