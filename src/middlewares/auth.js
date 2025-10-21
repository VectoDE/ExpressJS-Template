const httpStatus = require('http-status');
const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const config = require('../config/config');
const userService = require('../services/user.service');
const { roleRights } = require('../config/roles');

const auth = (...requiredRights) => async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.replace('Bearer ', '');
    }

    if (!token) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Authentication token missing');
    }

    const payload = jwt.verify(token, config.jwt.secret);
    const user = await userService.getUserById(payload.sub);

    if (!user) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User associated with token no longer exists');
    }

    req.user = user;

    if (requiredRights.length) {
      const userRights = roleRights.get(user.role) || [];
      const hasRequiredRights = requiredRights.every((requiredRight) => userRights.includes(requiredRight));

      if (!hasRequiredRights && req.params.userId !== user.id) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to perform this action');
      }
    }

    next();
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Invalid or expired authentication token';
    const statusCode = error instanceof ApiError ? error.statusCode : httpStatus.UNAUTHORIZED;
    next(new ApiError(statusCode, message));
  }
};

module.exports = auth;
