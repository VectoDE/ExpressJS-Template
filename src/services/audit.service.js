const db = require('../db');
const { AUDIT_EVENT_TYPES } = require('../db/records');
const { newId } = require('../utils/id');
const logger = require('../config/logger');

/**
 * Activity log per account. Writing an event must never break the action it describes,
 * so a failed write is logged as an error and the request carries on.
 */
const record = async (userId, type, context = {}) => {
  try {
    if (!AUDIT_EVENT_TYPES.includes(type)) {
      throw new Error(`Unknown audit event type ${type}`);
    }
    const device = context.device ? String(context.device).slice(0, 120) : undefined;
    await db.audit.add({ id: newId(), userId: String(userId), type, device });
  } catch (error) {
    logger.error('Audit event %s for user %s was not stored: %s', type, String(userId), error.message);
  }
};

const listForUser = (userId, limit = 20) => db.audit.list(String(userId), limit);

const removeForUser = (userId) => db.audit.removeForUser(String(userId));

module.exports = { TYPES: AUDIT_EVENT_TYPES, record, listForUser, removeForUser };
