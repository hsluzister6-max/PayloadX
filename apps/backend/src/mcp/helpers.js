import mongoose from 'mongoose';
import Team from '../../models/Team.js';

export function textResult(data, isError = false) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return {
    content: [{ type: 'text', text }],
    ...(isError ? { isError: true } : {}),
  };
}

export function errorResult(message) {
  return textResult({ error: message }, true);
}

export function toObjectId(id, label = 'id') {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new Error(`Invalid ${label}`);
  }
  return new mongoose.Types.ObjectId(String(id));
}

export async function assertTeamAccess(teamId, userId) {
  const team = await Team.findById(teamId).select('ownerId members.userId name').lean();
  if (!team) throw new Error('Team not found');
  const uid = String(userId);
  const ok =
    String(team.ownerId) === uid ||
    (team.members || []).some((m) => String(m.userId) === uid);
  if (!ok) throw new Error('Forbidden: not a member of this team');
  return team;
}

export function serializeDoc(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return JSON.parse(JSON.stringify(o));
}
