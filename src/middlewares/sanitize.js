const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 10;

const isUnsafeKey = (key) => key.startsWith('$') || key.includes('.') || FORBIDDEN_KEYS.has(key);

/**
 * Removes MongoDB operators (`$gt`, `a.b`) and prototype keys from user input, in place.
 * Joi validation and mongoose `sanitizeFilter` are the main guards; this is the outer layer.
 */
const clean = (value, depth = 0) => {
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (depth > MAX_DEPTH) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => clean(item, depth + 1));
  }
  const result = Object.create(null);
  Object.keys(value).forEach((key) => {
    if (!isUnsafeKey(key)) {
      result[key] = clean(value[key], depth + 1);
    }
  });
  return { ...result };
};

const sanitize = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = clean(req.body);
  }
  next();
};

module.exports = {
  sanitize,
  clean,
};
