const express = require('express');
const userController = require('../../controllers/user.controller');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const userValidation = require('../../validations/user.validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Profile and user administration
 */

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a user (admin)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUser'
 *     responses:
 *       "201":
 *         description: Created
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "409":
 *         description: Email already taken
 *   get:
 *     summary: List users (admin)
 *     tags: [Users]
 *     parameters:
 *       - { in: query, name: role, schema: { type: string, enum: [user, admin] } }
 *       - { in: query, name: search, description: Substring of name or email (case-insensitive), schema: { type: string, maxLength: 100 } }
 *       - { in: query, name: sortBy, schema: { type: string, example: "createdAt:desc" } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *     responses:
 *       "200":
 *         description: Page of users
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */
router
  .route('/')
  .post(auth('manageUsers'), validate(userValidation.createUser), userController.createUser)
  .get(auth('manageUsers'), validate(userValidation.getUsers), userController.getUsers);

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Profile of the signed-in user
 *     tags: [Users]
 *     responses:
 *       "200":
 *         description: Profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router.route('/profile').get(auth('getProfile'), userController.getProfile);

/**
 * @swagger
 * /users/{userId}:
 *   parameters:
 *     - { in: path, name: userId, required: true, schema: { type: string, pattern: "^[0-9a-fA-F]{24}$" } }
 *   get:
 *     summary: Get a user (admin)
 *     tags: [Users]
 *     responses:
 *       "200": { description: User }
 *       "401": { $ref: '#/components/responses/Unauthorized' }
 *       "403": { $ref: '#/components/responses/Forbidden' }
 *       "404": { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     summary: Update a user (admin)
 *     description: Changing password, email or role ends all sessions and tokens of that user.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUser'
 *     responses:
 *       "200": { description: Updated user }
 *       "400": { $ref: '#/components/responses/BadRequest' }
 *       "401": { $ref: '#/components/responses/Unauthorized' }
 *       "403": { $ref: '#/components/responses/Forbidden' }
 *       "404": { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     summary: Delete a user (admin)
 *     tags: [Users]
 *     responses:
 *       "204": { description: Deleted }
 *       "401": { $ref: '#/components/responses/Unauthorized' }
 *       "403": { $ref: '#/components/responses/Forbidden' }
 *       "404": { $ref: '#/components/responses/NotFound' }
 */
router
  .route('/:userId')
  .get(auth('manageUsers'), validate(userValidation.getUser), userController.getUser)
  .patch(auth('manageUsers'), validate(userValidation.updateUser), userController.updateUser)
  .delete(auth('manageUsers'), validate(userValidation.deleteUser), userController.deleteUser);

module.exports = router;
