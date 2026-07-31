import ActivityLog from '../../models/ActivityLog.js';

/**
 * Fire-and-forget activity write. Never throws to callers.
 */
export async function logActivity({
  userId,
  teamId,
  action,
  entityId,
  entityType,
  metadata = {},
}) {
  try {
    if (!userId || !action) return null;
    return await ActivityLog.create({
      userId,
      teamId: teamId || undefined,
      action,
      entityId: entityId || undefined,
      entityType: entityType || undefined,
      metadata,
    });
  } catch (err) {
    console.warn('[activityLog]', err.message);
    return null;
  }
}
