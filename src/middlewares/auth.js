const ApiError = require('../utils/ApiError');
const httpStatus = require('../utils/httpStatus');
const userService = require('../services/user.service');
const tokenService = require('../services/token.service');
const { tokenTypes } = require('../config/tokens');
const { roleRights } = require('../config/roles');

const BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

/**
 * Accepts only access tokens. Rights come from the role stored in the database, never from the token,
 * and tokens issued before the last password, email or role change are rejected.
 */
const auth =
  (...requiredRights) =>
  async (req, res, next) => {
    try {
      const match = BEARER.exec(req.get('Authorization') || '');
      if (!match) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required');
      }

      const payload = tokenService.decodeToken(match[1], tokenTypes.ACCESS);
      const user = await userService.getUserById(payload.sub);
      if (!user || payload.iat * 1000 < user.credentialsChangedAt.getTime()) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired token');
      }

      const userRights = roleRights.get(user.role) || [];
      if (!requiredRights.every((right) => userRights.includes(right))) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to perform this action');
      }

      req.user = user;
      return next();
    } catch (error) {
      if (error.statusCode === httpStatus.UNAUTHORIZED) {
        res.set('WWW-Authenticate', 'Bearer');
      }
      return next(error);
    }
  };

module.exports = auth;
