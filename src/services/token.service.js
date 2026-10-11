const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const config = require('../config/config');
const logger = require('../config/logger');
const { tokenTypes } = require('../config/tokens');
const Token = require('../models/token.model');
const ApiError = require('../utils/ApiError');
const httpStatus = require('../utils/httpStatus');
const { randomToken, sha256 } = require('../utils/crypto');

const ALGORITHM = 'HS256';
// Filters with operators are built here, never from input; mongoose.trusted lets them pass sanitizeFilter.
const INVALID_TOKEN = 'Invalid or expired token';

const hashToken = sha256;

const generateToken = (userId, expiresAt, type, claims = {}) =>
  jwt.sign({ ...claims, type }, config.jwt.secret, {
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

const revokeAllForUser = async (userId) => {
  await Token.deleteMany({ user: userId, type: tokenTypes.REFRESH });
};

/**
 * Single use: the stored refresh token is removed in the same step that validates it.
 * A valid token that is gone while its session (family) still has a newer token was already rotated:
 * someone is replaying it, so every session of that user is ended. A token whose whole family is gone
 * was signed out or revoked and simply stops working.
 */
const consumeRefreshToken = async (token) => {
  const payload = decodeToken(token, tokenTypes.REFRESH);
  const tokenDoc = await Token.findOneAndDelete({
    tokenHash: hashToken(token),
    type: tokenTypes.REFRESH,
    user: payload.sub,
  });
  if (!tokenDoc) {
    const rotated =
      typeof payload.fam === 'string' &&
      (await Token.exists({ user: payload.sub, type: tokenTypes.REFRESH, family: payload.fam }));
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
    issuedAt: payload.iat,
    session: { family: tokenDoc.family, device: tokenDoc.device, startedAt: tokenDoc.startedAt },
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

  await Token.create({
    tokenHash: hashToken(refreshToken),
    user: user.id,
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
  await Token.deleteOne({ tokenHash: hashToken(token), type: tokenTypes.REFRESH, user: payload.sub });
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
  await Token.deleteMany({ user: user.id, type });
  await Token.create({ tokenHash: hashToken(token), user: user.id, type, expires: expiresAt, ...extra });
  return token;
};

// Removes and returns the token in one step, so a link works exactly once. Expired tokens are refused.
const consumeEmailToken = async (token, type) => {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(token)) {
    return null;
  }
  return Token.findOneAndDelete({
    tokenHash: hashToken(token),
    type,
    expires: mongoose.trusted({ $gt: new Date() }),
  });
};

// Looks a token up without using it, so a page can tell at once whether a link is still valid.
const findEmailToken = async (token, type) => {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(token)) {
    return null;
  }
  return Token.findOne({ tokenHash: hashToken(token), type, expires: mongoose.trusted({ $gt: new Date() }) });
};

const removeEmailTokens = (userId, type) => Token.deleteMany({ user: userId, type });

// One entry per refresh-token family, which is one signed-in API client.
const listSessions = async (userId) => {
  const tokens = await Token.find(
    { user: userId, type: tokenTypes.REFRESH, expires: mongoose.trusted({ $gt: new Date() }) },
    { family: 1, device: 1, startedAt: 1, createdAt: 1, expires: 1 }
  )
    .sort({ createdAt: -1 })
    .lean();
  return tokens.map((token) => ({
    id: token.family || String(token._id),
    device: token.device || null,
    startedAt: token.startedAt || token.createdAt,
    lastRefreshedAt: token.createdAt,
    expiresAt: token.expires,
  }));
};

const revokeSession = async (userId, sessionId) => {
  const { deletedCount } = await Token.deleteMany({
    user: userId,
    type: tokenTypes.REFRESH,
    family: String(sessionId),
  });
  return deletedCount > 0;
};

module.exports = {
  hashToken,
  generateToken,
  decodeToken,
  consumeRefreshToken,
  generateAuthTokens,
  removeRefreshToken,
  revokeAllForUser,
  generateTwoFactorChallenge,
  createEmailToken,
  consumeEmailToken,
  findEmailToken,
  removeEmailTokens,
  listSessions,
  revokeSession,
};
