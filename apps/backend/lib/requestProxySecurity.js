import dns from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_HOSTS = new Set([
  'localhost',
  '0.0.0.0',
  'metadata.google.internal',
  '169.254.169.254',
]);

function createProxyError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeIp(ip) {
  return ip.replace(/^\[|\]$/g, '');
}

function isBlockedIpv4(ip) {
  const parts = ip.split('.').map((segment) => Number(segment));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b, c, d] = parts;

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;

  return false;
}

function isBlockedIpv6(ip) {
  const normalized = normalizeIp(ip).toLowerCase();

  if (normalized === '::' || normalized === '::1') {
    return true;
  }

  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true;
  }

  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }

  if (normalized.startsWith('::ffff:')) {
    return isBlockedIp(normalized.slice('::ffff:'.length));
  }

  return false;
}

function isBlockedIp(ip) {
  const normalized = normalizeIp(ip);
  const family = net.isIP(normalized);

  if (family === 4) {
    return isBlockedIpv4(normalized);
  }

  if (family === 6) {
    return isBlockedIpv6(normalized);
  }

  return false;
}

async function assertResolvedHostIsPublic(hostname) {
  const records = await dns.lookup(hostname, { all: true, verbatim: true }).catch(() => []);

  for (const record of records) {
    if (record?.address && isBlockedIp(record.address)) {
      throw createProxyError('Blocked: Internal/private IP addresses are not allowed for security.', 403);
    }
  }
}

export async function assertPublicHttpUrl(urlString) {
  let parsedUrl;

  try {
    parsedUrl = new URL(urlString);
  } catch (error) {
    throw createProxyError(`Invalid URL: ${error.message}`, 400);
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw createProxyError('Only HTTP and HTTPS URLs are supported.', 400);
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (!hostname) {
    throw createProxyError('URL must include a hostname.', 400);
  }

  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.localhost')) {
    throw createProxyError('Blocked: Internal/private IP addresses are not allowed for security.', 403);
  }

  if (isBlockedIp(hostname)) {
    throw createProxyError('Blocked: Internal/private IP addresses are not allowed for security.', 403);
  }

  if (!net.isIP(hostname)) {
    await assertResolvedHostIsPublic(hostname);
  }

  return parsedUrl;
}

export { createProxyError };
