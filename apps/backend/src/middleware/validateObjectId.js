import mongoose from 'mongoose';

/** True for a 24-char MongoDB ObjectId string. */
export function isValidObjectId(id) {
  return typeof id === 'string'
    && /^[a-f\d]{24}$/i.test(id)
    && mongoose.Types.ObjectId.isValid(id);
}

/** Local offline ids (temp_<uuid> / uuid) that must never hit findById. */
export function isTempId(id) {
  return typeof id === 'string'
    && (id.startsWith('temp_') || (id.includes('-') && !isValidObjectId(id)));
}

/**
 * Express middleware — reject temp / invalid :id before Mongo casts throw 500.
 * @param {string} [param='id']
 */
export function requireObjectId(param = 'id') {
  return (req, res, next) => {
    const id = req.params[param];
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        error: 'Invalid id',
        message:
          'Temporary offline ids cannot be used here. Create the resource first (POST), then update/delete with the server id.',
      });
    }
    return next();
  };
}
