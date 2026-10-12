const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const db = require('../db');
const logger = require('../config/logger');
const { tokenTypes } = require('../config/tokens');
const { newId } = require('../utils/id');
const ApiError = require('../utils/ApiError');
const httpStatus = require('../utils/httpStatus');
const { randomToken, sha256 } = require('../utils/crypto');

const ALGORITHM = 'HS256';
const INVALID_TOKEN = 'Invalid or expired token';

const hashToken = sha256;

// ims: issue time in milliseconds. iat only has whole seconds, which is too coarse to tell whether a token
// came before or after a credential change in the same second.
const generateToken = (userId, expiresAt, type, claims = {}) =>
  jwt.sign({ ...claims, type, ims: Date.now() }, config.jwt.secret, {
    algorithm: ALGORITHM,
    subject: String(userId),
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    jwtid: crypto.randomUUID(),
    expiresIn: Math.max(Math.floor((expiresAt.getTime() - Date.now()) / 1000), 1),
  });

/**
 * Checks signature, algorithm, issuer, audience, expiry and the token type.
 * An access token can never be used as a refresh or two-factor token and the other way round.
 */
const decodeToken = (token, type) => {
  if (typeof token !== 'string' || token.length > 2048) {
    throw new ApiError(httpStatus.UNAUTHORIZED, INVALID_TOKEN);
  }
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret, {
      algorithms: [ALGORITHM],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, INVALID_TOKEN);
  }
  if (payload.type !== type || typeof payload.sub !== 'string') {
    throw new ApiError(httpStatus.UNAUTHORIZED, INVALID_TOKEN);
  }
  return payload;
};

const issuedAtMs = (payload) => (Number.isSafeInteger(payload.ims) ? payload.ims : payload.iat * 1000);

// True when the token predates the last password, email or role change of the user and must not be accepted.
const issuedBeforeCredentialChange = (payload, user) => issuedAtMs(payload) < user.credentialsChangedAt.getTime();

const revokeAllForUser = async (userId) => {
  await db.tokens.remove({ userId: String(userId), type: tokenTypes.REFRESH });
};

/**
 * Single use: the stored refresh token is removed in the same step that validates it.
 * A valid token that is gone while its session (family) still has a newer token was already rotated:
 * someone is replaying it, so every session of that user is ended. A token whose whole family is gone
 * was signed out or revoked and simply stops working.
 */
const consumeRefreshToken = async (token) => {
  const payload = decodeToken(token, tokenTypes.REFRESH);
  const stored = await db.tokens.take({ tokenHash: hashToken(token), type: tokenTypes.REFRESH, userId: payload.sub });
  if (!stored) {
    const rotated =
      typeof payload.fam === 'string' &&
      (await db.tokens.exists({ userId: payload.sub, type: tokenTypes.REFRESH, family: payload.fam }));
    const error = new ApiError(httpStatus.UNAUTHORIZED, INVALID_TOKEN);
    if (rotated) {
      logger.warn('Refresh token reuse detected for user %s, revoking all refresh tokens', payload.sub);
      await revokeAllForUser(payload.sub);
      error.reuseDetectedFor = payload.sub;
    }
    throw error;
  }
  return {
    userId: payload.sub,
    payload,
    session: { family: stored.family, device: stored.device, startedAt: stored.startedAt },
  };
};

/**
 * Issues an access and a refresh token. A sign-in starts a new session (family); a refresh passes
 * the old session on, so the session list stays stable while tokens rotate.
 */
const generateAuthTokens = async (user, session = {}) => {
  const accessExpires = new Date(Date.now() + config.jwt.accessExpirationMinutes * 60 * 1000);
  const refreshExpires = new Date(Date.now() + config.jwt.refreshExpirationDays * 24 * 60 * 60 * 1000);
  const family = session.family || crypto.randomUUID();
  const accessToken = generateToken(user.id, accessExpires, tokenTypes.ACCESS);
  const refreshToken = generateToken(user.id, refreshExpires, tokenTypes.REFRESH, { fam: family });

  await db.tokens.create({
    id: newId(),
    tokenHash: hashToken(refreshToken),
    userId: user.id,
    expires: refreshExpires,
    type: tokenTypes.REFRESH,
    family,
    device: session.device ? String(session.device).slice(0, 120) : undefined,
    startedAt: session.startedAt || new Date(),
  });

  return {
    access: { token: accessToken, expires: accessExpires },
    refresh: { token: refreshToken, expires: refreshExpires },
  };
};

const removeRefreshToken = async (token) => {
  const payload = decodeToken(token, tokenTypes.REFRESH);
  await db.tokens.remove({ tokenHash: hashToken(token), type: tokenTypes.REFRESH, userId: payload.sub });
};

// Short-lived proof that the password was correct, exchanged for tokens together with a one-time code.
const generateTwoFactorChallenge = (user) =>
  generateToken(
    user.id,
    new Date(Date.now() + config.auth.twoFactorChallengeMinutes * 60 * 1000),
    tokenTypes.TWO_FACTOR
  );

/**
 * Opaque single-use token for a link in an email (password reset, email verification).
 * Only the SHA-256 is stored; older tokens of the same type for the user are replaced.
 */
const createEmailToken = async (user, type, expiresAt, extra = {}) => {
  const token = randomToken();
  await db.tokens.remove({ userId: user.id, type });
  await db.tokens.create({
    id: newId(),
    tokenHash: hashToken(token),
    userId: user.id,
    type,
    expires: expiresAt,
    ...extra,
  });
  return token;
};

// Removes and returns the token in one step, so a link works exactly once. Expired tokens are refused.
const consumeEmailToken = async (token, type) => {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(token)) {
    return null;
  }
  return db.tokens.take({ tokenHash: hashToken(token), type, validAt: new Date() });
};

// Looks a token up without using it, so a page can tell at once whether a link is still valid.
const findEmailToken = async (token, type) => {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(token)) {
    return null;
  }
  return db.tokens.find({ tokenHash: hashToken(token), type, validAt: new Date() });
};

const removeEmailTokens = (userId, type) => db.tokens.remove({ userId: String(userId), type });

// One entry per refresh-token family, which is one signed-in API client.
const listSessions = async (userId) => {
  const tokens = await db.tokens.list({ userId: String(userId), type: tokenTypes.REFRESH, validAt: new Date() });
  return tokens.map((token) => ({
    id: token.family || token.id,
    device: token.device || null,
    startedAt: token.startedAt || token.createdAt,
    lastRefreshedAt: token.createdAt,
    expiresAt: token.expires,
  }));
};

const revokeSession = async (userId, sessionId) => {
  const removed = await db.tokens.remove({
    userId: String(userId),
    type: tokenTypes.REFRESH,
    family: String(sessionId),
  });
  return removed > 0;
};

module.exports = {
  hashToken,
  generateToken,
  decodeToken,
  consumeRefreshToken,
  generateAuthTokens,
  removeRefreshToken,
  revokeAllForUser,
  issuedBeforeCredentialChange,
  generateTwoFactorChallenge,
  createEmailToken,
  consumeEmailToken,
  findEmailToken,
  removeEmailTokens,
  listSessions,
  revokeSession,
};
