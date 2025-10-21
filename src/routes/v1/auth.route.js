const express = require('express');
const authController = require('../../controllers/auth.controller');
const validate = require('../../middlewares/validate');
const authValidation = require('../../validations/auth.validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and authorization
 */

/**
 * @swagger
 * /v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterUser'
 *     responses:
 *       "201":
 *         description: User created successfully
 *       "400":
 *         description: Email already taken
 */
router.post('/register', validate(authValidation.register), authController.register);

/**
 * @swagger
 * /v1/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginUser'
 *     responses:
 *       "200":
 *         description: Successfully authenticated
 *       "401":
 *         description: Incorrect email or password
 */
router.post('/login', validate(authValidation.login), authController.login);

router.post('/logout', validate(authValidation.logout), authController.logout);
router.post('/refresh-tokens', validate(authValidation.refreshTokens), authController.refreshTokens);

module.exports = router;
