/**
 * Plain records shared by every database adapter. Adapters convert their rows or documents into these shapes, so
 * services never see database specifics.
 */

const LOCALES = ['en', 'de'];

const AUDIT_EVENT_TYPES = [
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

// Fields that hold secrets or internal state. They exist on a user record but are not enumerable, so
// res.json(user), JSON.stringify and object spreads never include them by accident.
const HIDDEN_USER_FIELDS = ['password', 'twoFactor', 'failedLoginAttempts', 'lockUntil'];

const VISIBLE_USER_FIELDS = [
  'id',
  'name',
  'email',
  'role',
  'isEmailVerified',
  'locale',
  'credentialsChangedAt',
  'createdAt',
  'updatedAt',
];

const emptyTwoFactor = () => ({
  enabled: false,
  secret: null,
  pendingSecret: null,
  lastUsedStep: -1,
  recoveryCodes: [],
  enabledAt: null,
});

const toDate = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  // SQL stores milliseconds, MongoDB and JSON hand over dates or ISO strings.
  const millis = Number(value);
  return new Date(Number.isNaN(millis) ? value : millis);
};

const userRecord = (data) => {
  const user = {};
  VISIBLE_USER_FIELDS.forEach((field) => {
    user[field] = data[field];
  });
  user.isEmailVerified = Boolean(user.isEmailVerified);
  ['credentialsChangedAt', 'createdAt', 'updatedAt'].forEach((field) => {
    user[field] = toDate(user[field]);
  });
  const hidden = {
    password: data.password ?? null,
    twoFactor: { ...emptyTwoFactor(), ...data.twoFactor },
    failedLoginAttempts: Number(data.failedLoginAttempts) || 0,
    lockUntil: toDate(data.lockUntil),
  };
  hidden.twoFactor.enabled = Boolean(hidden.twoFactor.enabled);
  hidden.twoFactor.lastUsedStep = Number(hidden.twoFactor.lastUsedStep ?? -1);
  hidden.twoFactor.enabledAt = toDate(hidden.twoFactor.enabledAt);
  hidden.twoFactor.recoveryCodes = [...(hidden.twoFactor.recoveryCodes || [])];
  HIDDEN_USER_FIELDS.forEach((field) => {
    Object.defineProperty(user, field, { value: hidden[field], writable: true, enumerable: false, configurable: true });
  });
  return user;
};

const tokenRecord = (data) => ({
  id: data.id,
  tokenHash: data.tokenHash,
  userId: data.userId,
  type: data.type,
  expires: toDate(data.expires),
  family: data.family ?? null,
  device: data.device ?? null,
  startedAt: toDate(data.startedAt),
  email: data.email ?? null,
  createdAt: toDate(data.createdAt),
});

const auditRecord = (data) => ({ type: data.type, device: data.device ?? null, createdAt: toDate(data.createdAt) });

module.exports = {
  LOCALES,
  AUDIT_EVENT_TYPES,
  HIDDEN_USER_FIELDS,
  emptyTwoFactor,
  toDate,
  userRecord,
  tokenRecord,
  auditRecord,
};
