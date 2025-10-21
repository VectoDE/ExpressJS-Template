const jwt = require('jsonwebtoken');
const dayjs = require('dayjs');
const httpStatus = require('http-status');
const config = require('../config/config');
const { tokenTypes } = require('../config/tokens');
const Token = require('../models/token.model');
const ApiError = require('../utils/ApiError');

const generateToken = (userId, expires, type, secret = config.jwt.secret) => {
  const payload = {
    sub: userId,
    iat: dayjs().unix(),
    exp: expires.unix(),
    type,
  };

  return jwt.sign(payload, secret);
};

const saveToken = async (token, userId, expires, type, blacklisted = false) => {
  const tokenDoc = await Token.create({
    token,
    user: userId,
    expires: expires.toDate(),
    type,
    blacklisted,
  });
  return tokenDoc;
};

const verifyToken = async (token, type) => {
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Token validation failed');
  }

  const tokenDoc = await Token.findOne({
    token,
    type,
    user: payload.sub,
    blacklisted: false,
  });

  if (!tokenDoc) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Token not found');
  }
  return tokenDoc;
};

const generateAuthTokens = async (user) => {
  const accessTokenExpires = dayjs().add(config.jwt.accessExpirationMinutes, 'minutes');
  const accessToken = generateToken(user.id, accessTokenExpires, tokenTypes.ACCESS);

  const refreshTokenExpires = dayjs().add(config.jwt.refreshExpirationDays, 'days');
  const refreshToken = generateToken(user.id, refreshTokenExpires, tokenTypes.REFRESH);
  await saveToken(refreshToken, user.id, refreshTokenExpires, tokenTypes.REFRESH);

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate(),
    },
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires.toDate(),
    },
  };
};

const removeToken = async (token, type) => {
  const tokenDoc = await Token.findOne({ token, type, blacklisted: false });
  if (!tokenDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Token not found');
  }
  await tokenDoc.deleteOne();
};

module.exports = {
  generateToken,
  saveToken,
  verifyToken,
  generateAuthTokens,
  removeToken,
};
