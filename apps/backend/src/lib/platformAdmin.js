/**
 * Platform (PayloadX) admin helpers.
 * Admins = ADMIN_EMAILS env (comma-separated) + built-in owners.
 */

const DEFAULT_ADMIN_EMAILS = ['sundansharma600@gmail.com'];

export function getAdminEmails() {
  const fromEnv = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ADMIN_EMAILS, ...fromEnv])];
}

export function isPlatformAdminEmail(email) {
  if (!email) return false;
  return getAdminEmails().includes(String(email).toLowerCase());
}

/**
 * Express middleware — requires authenticate first.
 */
export function requirePlatformAdmin(req, res, next) {
  const email = req.user?.email;
  if (!isPlatformAdminEmail(email)) {
    return res.status(403).json({ error: 'Platform admin access required' });
  }
  return next();
}
