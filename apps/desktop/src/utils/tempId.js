/** Local offline ids — never send these as Mongo ObjectIds. */
export function isTempId(id) {
  if (typeof id !== 'string' || !id) return false;
  if (id.startsWith('temp_')) return true;
  // UUIDs contain dashes; real Mongo ObjectIds are 24 hex chars
  if (id.includes('-') && !/^[a-f\d]{24}$/i.test(id)) return true;
  return false;
}

export function isMongoObjectId(id) {
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
}

/** Strip local-only id fields before POST create. */
export function stripTempIds(data) {
  if (!data || typeof data !== 'object') return data;
  const { _id, id, tempId, ...rest } = data;
  if (isTempId(_id) || isTempId(id) || isTempId(tempId)) {
    return rest;
  }
  if (_id !== undefined && !isMongoObjectId(_id)) {
    return rest;
  }
  return data;
}
