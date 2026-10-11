const mongoose = require('mongoose');
const config = require('../config/config');

/**
 * Security-relevant events per account, shown to the user and included in the data export.
 * Deleted automatically after AUDIT_RETENTION_DAYS and together with the account.
 */
const EVENT_TYPES = [
  'login',
  'loginFailed',
  'accountLocked',
  'passwordChanged',
  'passwordReset',
  'passwordResetRequested',
  'emailChanged',
  'emailVerified',
  'twoFactorEnabled',
  'twoFactorDisabled',
  'recoveryCodeUsed',
  'sessionRevoked',
  'allSessionsRevoked',
  'refreshTokenReuse',
  'roleChanged',
];

const auditEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: EVENT_TYPES, required: true },
    device: { type: String, maxlength: 120 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditEventSchema.index({ user: 1, createdAt: -1 });
auditEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: config.audit.retentionDays * 24 * 60 * 60 });

const AuditEvent = mongoose.model('AuditEvent', auditEventSchema);
AuditEvent.TYPES = EVENT_TYPES;

module.exports = AuditEvent;
