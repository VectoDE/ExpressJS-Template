const express = require('express');
const accountController = require('../../controllers/account.controller');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { authLimiter } = require('../../middlewares/rateLimit');
const accountValidation = require('../../validations/account.validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Account
 *   description: Self-service for the signed-in user (GDPR Art. 15, 16, 17 and 20)
 */

/**
 * @swagger
 * /account/export:
 *   get:
 *     summary: Download all personal data of the signed-in user as JSON
 *     tags: [Account]
 *     responses:
 *       "200":
 *         description: Machine-readable export
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/export', auth('getProfile'), accountController.exportData);

/**
 * @swagger
 * /account:
 *   patch:
 *     summary: Correct your own name, email or password
 *     description: Email and password changes need currentPassword and end all other sessions.
 *     tags: [Account]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             properties:
 *               name: { type: string, minLength: 3, maxLength: 120 }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 12, maxLength: 128 }
 *               currentPassword: { type: string, maxLength: 128 }
 *               locale: { type: string, enum: [de, en] }
 *     responses:
 *       "200": { description: Updated profile }
 *       "400": { $ref: '#/components/responses/BadRequest' }
 *       "401": { $ref: '#/components/responses/Unauthorized' }
 *       "403": { description: Current password is incorrect }
 *       "409": { description: Email already taken }
 *   delete:
 *     summary: Delete your own account, all its tokens and its activity log
 *     tags: [Account]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, maxLength: 128 }
 *     responses:
 *       "204": { description: Account deleted }
 *       "401": { $ref: '#/components/responses/Unauthorized' }
 *       "403": { description: Password is incorrect }
 */
router
  .route('/')
  .patch(authLimiter, auth('getProfile'), validate(accountValidation.updateProfile), accountController.updateProfile)
  .delete(authLimiter, auth('getProfile'), validate(accountValidation.deleteAccount), accountController.deleteAccount);

/**
 * @swagger
 * /account/sessions:
 *   get:
 *     summary: Signed-in API clients (one entry per refresh-token family)
 *     tags: [Account]
 *     responses:
 *       "200":
 *         description: Sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Session' }
 *       "401": { $ref: '#/components/responses/Unauthorized' }
 *   delete:
 *     summary: Sign out everywhere
 *     description: Revokes every refresh token and invalidates all access tokens and browser sessions of the account.
 *     tags: [Account]
 *     responses:
 *       "204": { description: All sessions ended }
 *       "401": { $ref: '#/components/responses/Unauthorized' }
 */
router
  .route('/sessions')
  .get(auth('getProfile'), accountController.getSessions)
  .delete(authLimiter, auth('getProfile'), accountController.deleteSessions);

/**
 * @swagger
 * /account/sessions/{sessionId}:
 *   delete:
 *     summary: Sign out one API client
 *     tags: [Account]
 *     parameters:
 *       - { in: path, name: sessionId, required: true, schema: { type: string } }
 *     responses:
 *       "204": { description: Session ended }
 *       "401": { $ref: '#/components/responses/Unauthorized' }
 *       "404": { $ref: '#/components/responses/NotFound' }
 */
router.delete(
  '/sessions/:sessionId',
  auth('getProfile'),
  validate(accountValidation.sessionId),
  accountController.deleteSession
);

/**
 * @swagger
 * /account/activity:
 *   get:
 *     summary: Recent security events of the account (sign-ins, password and 2FA changes)
 *     tags: [Account]
 *     responses:
 *       "200":
 *         description: Newest first, at most 50
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/AuditEvent' }
 *       "401": { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/activity', auth('getProfile'), accountController.getActivity);

/**
 * @swagger
 * /account/2fa:
 *   get:
 *     summary: Two-factor status
 *     tags: [Account]
 *     responses:
 *       "200":
 *         description: Status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TwoFactorStatus' }
 *       "401": { $ref: '#/components/responses/Unauthorized' }
 * /account/2fa/setup:
 *   post:
 *     summary: Start the two-factor setup
 *     description: Returns the secret, an otpauth URL and a QR code as SVG. Nothing is active until /account/2fa/enable.
 *     tags: [Account]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [password], properties: { password: { type: string } } }
 *     responses:
 *       "200": { description: Pending secret }
 *       "403": { description: Password is incorrect }
 *       "409": { description: Already enabled }
 * /account/2fa/enable:
 *   post:
 *     summary: Confirm the setup with a code from the app
 *     description: Returns ten single-use recovery codes. They are shown only this once.
 *     tags: [Account]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [code], properties: { code: { type: string, example: "123456" } } }
 *     responses:
 *       "200": { description: Enabled, recovery codes in the body }
 *       "400": { description: Invalid code or no pending setup }
 * /account/2fa/disable:
 *   post:
 *     summary: Turn two-factor sign-in off
 *     tags: [Account]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password, code]
 *             properties: { password: { type: string }, code: { type: string } }
 *     responses:
 *       "204": { description: Disabled }
 *       "403": { description: Password or code is incorrect }
 * /account/2fa/recovery-codes:
 *   post:
 *     summary: Replace all recovery codes
 *     tags: [Account]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [code], properties: { code: { type: string } } }
 *     responses:
 *       "200": { description: New recovery codes in the body }
 *       "403": { description: Code is incorrect }
 */
router.get('/2fa', auth('getProfile'), accountController.getTwoFactor);
router.post(
  '/2fa/setup',
  authLimiter,
  auth('getProfile'),
  validate(accountValidation.setupTwoFactor),
  accountController.setupTwoFactor
);
router.post(
  '/2fa/enable',
  authLimiter,
  auth('getProfile'),
  validate(accountValidation.enableTwoFactor),
  accountController.enableTwoFactor
);
router.post(
  '/2fa/disable',
  authLimiter,
  auth('getProfile'),
  validate(accountValidation.disableTwoFactor),
  accountController.disableTwoFactor
);
router.post(
  '/2fa/recovery-codes',
  authLimiter,
  auth('getProfile'),
  validate(accountValidation.recoveryCodes),
  accountController.renewRecoveryCodes
);

/**
 * @swagger
 * /account/passkeys:
 *   get:
 *     summary: Passkeys of the account
 *     tags: [Account]
 *     responses:
 *       "200":
 *         description: Passkeys, oldest first
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results: { type: array, items: { $ref: '#/components/schemas/Passkey' } }
 *       "401": { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     summary: Add a passkey
 *     description: >
 *       Second step. `response` is the JSON form of the credential that navigator.credentials.create() returned for
 *       the options of /account/passkeys/options. The browser must run on the origin of APP_URL.
 *     tags: [Account]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, response]
 *             properties:
 *               name: { type: string, maxLength: 60, example: "Laptop" }
 *               response: { type: object }
 *     responses:
 *       "201":
 *         description: Added
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Passkey' }
 *       "400": { description: Two-factor sign-in is off, or the passkey could not be verified }
 *       "409": { description: Limit of 10 passkeys reached }
 * /account/passkeys/options:
 *   post:
 *     summary: Start adding a passkey
 *     description: >
 *       Needs the password and two-factor sign-in turned on. Returns PublicKeyCredentialCreationOptionsJSON with a
 *       challenge that works once within five minutes.
 *     tags: [Account]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [password], properties: { password: { type: string } } }
 *     responses:
 *       "200": { description: Options for navigator.credentials.create() }
 *       "400": { description: Two-factor sign-in is off }
 *       "403": { description: Password is incorrect }
 *       "409": { description: Limit of 10 passkeys reached }
 * /account/passkeys/{passkeyId}:
 *   delete:
 *     summary: Remove a passkey
 *     tags: [Account]
 *     parameters:
 *       - { in: path, name: passkeyId, required: true, schema: { type: string } }
 *     responses:
 *       "204": { description: Removed }
 *       "404": { $ref: '#/components/responses/NotFound' }
 */
router.get('/passkeys', auth('getProfile'), accountController.listPasskeys);
router.post(
  '/passkeys/options',
  authLimiter,
  auth('getProfile'),
  validate(accountValidation.passkeyOptions),
  accountController.passkeyOptions
);
router.post(
  '/passkeys',
  authLimiter,
  auth('getProfile'),
  validate(accountValidation.addPasskey),
  accountController.addPasskey
);
router.delete(
  '/passkeys/:passkeyId',
  auth('getProfile'),
  validate(accountValidation.passkeyId),
  accountController.removePasskey
);

module.exports = router;
