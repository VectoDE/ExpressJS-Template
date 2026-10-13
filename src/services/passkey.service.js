// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const config = require('../config/config');
const logger = require('../config/logger');
const db = require('../db');
const { tokenTypes } = require('../config/tokens');
const ApiError = require('../utils/ApiError');
const httpStatus = require('../utils/httpStatus');
const { newId } = require('../utils/id');
const { sha256 } = require('../utils/crypto');
const { oneLine } = require('../utils/redact');
const auditService = require('./audit.service');
const emailService = require('./email.service');
const twoFactorService = require('./twoFactor.service');

/**
 * Passkeys (WebAuthn) as a second factor next to one-time codes. They need two-factor sign-in to be on, so the
 * recovery codes stay the way back in, and turning two-factor sign-in off removes them as well.
 * Every ceremony has a single-use challenge, stored as a hash with the tokens and valid for five minutes.
 */
const MAX_PASSKEYS = 10;
const CHALLENGE_MS = 5 * 60 * 1000;
// Ed25519, ES256 and RS256: what authenticators support today. Naming them also keeps the library from probing
// for the experimental post-quantum algorithms, which prints a warning on Node.js 26.
const ALGORITHMS = [-8, -7, -257];

// The relying party is the site in APP_URL: passkeys only work under that host name.
const relyingParty = () => {
  const url = new URL(config.appUrl);
  return { id: url.hostname, origin: url.origin, name: config.appName };
};

const issueChallenge = (userId, type, challenge) =>
  db.tokens.create({
    id: newId(),
    tokenHash: sha256(challenge),
    userId: String(userId),
    type,
    expires: new Date(Date.now() + CHALLENGE_MS),
  });

// Accepts the challenge from the signed client data only once, and only for this user and ceremony.
const takeChallenge = (userId, type) => async (challenge) =>
  Boolean(await db.tokens.take({ tokenHash: sha256(challenge), type, userId: String(userId), validAt: new Date() }));

const describe = (passkey) => ({
  id: passkey.id,
  name: passkey.name,
  createdAt: passkey.createdAt,
  lastUsedAt: passkey.lastUsedAt,
});

const list = async (userId) => (await db.passkeys.listForUser(String(userId))).map((passkey) => describe(passkey));

const requireTwoFactor = (user) => {
  if (!user.twoFactor?.enabled) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Turn on two-factor authentication first');
  }
};

/**
 * First step of adding a passkey: checks the password and returns the options for navigator.credentials.create().
 */
const registrationOptions = async (userId, password) => {
  const user = await twoFactorService.loadUser(userId);
  await twoFactorService.confirmPassword(user, password);
  requireTwoFactor(user);
  const existing = await db.passkeys.listForUser(user.id);
  if (existing.length >= MAX_PASSKEYS) {
    throw new ApiError(httpStatus.CONFLICT, 'Passkey limit reached');
  }
  const rp = relyingParty();
  const options = await generateRegistrationOptions({
    rpName: rp.name,
    rpID: rp.id,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: 'none',
    excludeCredentials: existing.map((passkey) => ({ id: passkey.credentialId, transports: passkey.transports })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    timeout: CHALLENGE_MS,
    supportedAlgorithmIDs: ALGORITHMS,
  });
  await issueChallenge(user.id, tokenTypes.PASSKEY_REGISTRATION, options.challenge);
  return options;
};

const invalidPasskey = () => new ApiError(httpStatus.BAD_REQUEST, 'The passkey could not be verified');

// Second step: verifies the response of the authenticator and stores the credential.
const register = async (userId, { name, response }, context = {}) => {
  const user = await twoFactorService.loadUser(userId);
  requireTwoFactor(user);
  const rp = relyingParty();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: takeChallenge(user.id, tokenTypes.PASSKEY_REGISTRATION),
      expectedOrigin: rp.origin,
      expectedRPID: rp.id,
      requireUserVerification: false,
      supportedAlgorithmIDs: ALGORITHMS,
    });
  } catch (error) {
    logger.info('Passkey registration rejected for user %s: %s', user.id, oneLine(error.message));
    throw invalidPasskey();
  }
  if (!verification.verified) {
    throw invalidPasskey();
  }
  const { credential } = verification.registrationInfo;
  const existing = await db.passkeys.listForUser(user.id);
  if (existing.length >= MAX_PASSKEYS || existing.some((passkey) => passkey.credentialId === credential.id)) {
    throw new ApiError(httpStatus.CONFLICT, 'Passkey limit reached');
  }
  const passkey = await db.passkeys.create({
    id: newId(),
    userId: user.id,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: credential.transports || [],
    name,
  });
  await auditService.record(user.id, 'passkeyAdded', context);
  emailService.notify(user, 'passkeyAdded', { passkeyName: name });
  return describe(passkey);
};

const remove = async (userId, passkeyId, context = {}) => {
  const user = await twoFactorService.loadUser(userId);
  if (!(await db.passkeys.remove(user.id, passkeyId))) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Passkey not found');
  }
  await auditService.record(user.id, 'passkeyRemoved', context);
  emailService.notify(user, 'passkeyRemoved');
};

const removeAll = (userId) => db.passkeys.removeForUser(String(userId));

/**
 * Options for navigator.credentials.get() during sign-in, or null when the account has no passkey.
 * Only called after the password step, so it reveals nothing to someone who does not know the password.
 */
const authenticationOptions = async (userId) => {
  const passkeys = await db.passkeys.listForUser(String(userId));
  if (!passkeys.length) {
    return null;
  }
  const options = await generateAuthenticationOptions({
    rpID: relyingParty().id,
    allowCredentials: passkeys.map((passkey) => ({ id: passkey.credentialId, transports: passkey.transports })),
    userVerification: 'preferred',
    timeout: CHALLENGE_MS,
  });
  await issueChallenge(userId, tokenTypes.PASSKEY_LOGIN, options.challenge);
  return options;
};

// True when the response is a valid signature of one of the user's passkeys over a challenge issued for them.
const verifyAssertion = async (user, response) => {
  const passkeys = await db.passkeys.listForUser(user.id);
  const passkey = passkeys.find((candidate) => candidate.credentialId === response?.id);
  if (!passkey) {
    return false;
  }
  const rp = relyingParty();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: takeChallenge(user.id, tokenTypes.PASSKEY_LOGIN),
      expectedOrigin: rp.origin,
      expectedRPID: rp.id,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64url')),
        counter: passkey.counter,
        transports: passkey.transports,
      },
      requireUserVerification: false,
    });
  } catch (error) {
    logger.info('Passkey sign-in rejected for user %s: %s', user.id, oneLine(error.message));
    return false;
  }
  if (!verification.verified) {
    return false;
  }
  return db.passkeys.recordUse(user.id, passkey.id, verification.authenticationInfo.newCounter, new Date());
};

module.exports = {
  MAX_PASSKEYS,
  list,
  registrationOptions,
  register,
  remove,
  removeAll,
  authenticationOptions,
  verifyAssertion,
};
