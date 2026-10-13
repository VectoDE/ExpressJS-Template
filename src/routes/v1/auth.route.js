// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const express = require('express');
const authController = require('../../controllers/auth.controller');
const validate = require('../../middlewares/validate');
const { authLimiter, emailLimiter } = require('../../middlewares/rateLimit');
const auth = require('../../middlewares/auth');
const authValidation = require('../../validations/auth.validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Sign-up, sign-in and token handling
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Always creates a regular user. A role in the body is rejected.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterUser'
 *     responses:
 *       "201":
 *         description: User created, tokens issued
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "409":
 *         description: Email already taken
 *       "429":
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.post('/register', authLimiter, validate(authValidation.register), authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Sign in with email and password
 *     description: >
 *       Returns tokens, or, when two-factor sign-in is on, a short-lived challengeToken for /auth/login/2fa.
 *       With AUTH_REQUIRE_VERIFIED_EMAIL an unverified account gets 403 and a new verification email.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginUser'
 *     responses:
 *       "200":
 *         description: Signed in, or second factor required
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/AuthResponse'
 *                 - $ref: '#/components/schemas/TwoFactorChallenge'
 *       "401":
 *         description: Incorrect email or password (also returned while the account is locked)
 *       "403":
 *         description: Email address not verified (only with AUTH_REQUIRE_VERIFIED_EMAIL)
 *       "429":
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.post('/login', authLimiter, validate(authValidation.login), authController.login);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Revoke a refresh token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshToken'
 *     responses:
 *       "204":
 *         description: Token revoked
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/logout', validate(authValidation.logout), authController.logout);

/**
 * @swagger
 * /auth/refresh-tokens:
 *   post:
 *     summary: Exchange a refresh token for a new token pair
 *     description: Refresh tokens are single use. Presenting a used one revokes every session of that user.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshToken'
 *     responses:
 *       "200":
 *         description: New token pair
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "429":
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.post('/refresh-tokens', authLimiter, validate(authValidation.refreshTokens), authController.refreshTokens);

/**
 * @swagger
 * /auth/login/2fa:
 *   post:
 *     summary: Complete a sign-in with a one-time code or a recovery code
 *     description: Wrong codes count towards the account lockout. A used recovery code is reported in X-Recovery-Codes-Remaining.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [challengeToken, code]
 *             properties:
 *               challengeToken: { type: string }
 *               code: { type: string, example: "123456" }
 *     responses:
 *       "200":
 *         description: Signed in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "429":
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.post('/login/2fa', authLimiter, validate(authValidation.loginTwoFactor), authController.loginTwoFactor);

/**
 * @swagger
 * /auth/login/passkey/options:
 *   post:
 *     summary: Options for signing in with a passkey instead of a code
 *     description: Returns PublicKeyCredentialRequestOptionsJSON for navigator.credentials.get(), valid once for five minutes.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [challengeToken], properties: { challengeToken: { type: string } } }
 *     responses:
 *       "200": { description: Options for navigator.credentials.get() }
 *       "401": { $ref: '#/components/responses/Unauthorized' }
 *       "404": { description: The account has no passkey }
 *       "429": { $ref: '#/components/responses/TooManyRequests' }
 * /auth/login/passkey:
 *   post:
 *     summary: Complete a sign-in with a passkey
 *     description: A rejected passkey counts towards the account lockout, like a wrong code.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [challengeToken, response]
 *             properties:
 *               challengeToken: { type: string }
 *               response: { type: object, description: JSON form of the credential from navigator.credentials.get() }
 *     responses:
 *       "200":
 *         description: Signed in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "429":
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.post(
  '/login/passkey/options',
  authLimiter,
  validate(authValidation.passkeyChallenge),
  authController.passkeyOptions
);
router.post('/login/passkey', authLimiter, validate(authValidation.loginPasskey), authController.loginPasskey);

/**
 * @swagger
 * /auth/send-verification-email:
 *   post:
 *     summary: Send a new email verification link to the signed-in user
 *     tags: [Auth]
 *     responses:
 *       "204": { description: Link sent }
 *       "400": { description: Email address is already verified }
 *       "401": { $ref: '#/components/responses/Unauthorized' }
 *       "429": { $ref: '#/components/responses/TooManyRequests' }
 */
router.post('/send-verification-email', emailLimiter, auth('getProfile'), authController.sendVerificationEmail);

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify an email address with the token from the email
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailToken'
 *     responses:
 *       "204": { description: Email address verified }
 *       "400": { description: Invalid or expired link }
 */
router.post('/verify-email', authLimiter, validate(authValidation.verifyEmail), authController.verifyEmail);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset link
 *     description: Always 204, so the endpoint does not reveal whether an account exists.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       "204": { description: Request accepted }
 *       "400": { $ref: '#/components/responses/BadRequest' }
 *       "429": { $ref: '#/components/responses/TooManyRequests' }
 */
router.post('/forgot-password', emailLimiter, validate(authValidation.forgotPassword), authController.forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Set a new password with the token from the reset email
 *     description: Ends every session and token of the account and lifts a running lockout.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string, minLength: 12, maxLength: 128 }
 *     responses:
 *       "204": { description: Password changed }
 *       "400": { description: Invalid or expired link, or the password does not meet the rules }
 *       "429": { $ref: '#/components/responses/TooManyRequests' }
 */
router.post('/reset-password', authLimiter, validate(authValidation.resetPassword), authController.resetPassword);

module.exports = router;
