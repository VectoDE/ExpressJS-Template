const AuditEvent = require('../models/auditEvent.model');
const logger = require('../config/logger');

/**
 * Activity log per account. Writing an event must never break the action it describes,
 * so a failed write is logged as an error and the request carries on.
 */
const record = async (userId, type, context = {}) => {
  try {
    await AuditEvent.create({ user: userId, type, device: context.device || undefined });
  } catch (error) {
    logger.error('Audit event %s for user %s was not stored: %s', type, String(userId), error.message);
  }
};

const listForUser = (userId, limit = 20) =>
  AuditEvent.find({ user: userId }, { type: 1, device: 1, createdAt: 1, _id: 0 })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

const removeForUser = (userId) => AuditEvent.deleteMany({ user: userId });

module.exports = { record, listForUser, removeForUser };
