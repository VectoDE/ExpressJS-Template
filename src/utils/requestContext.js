const { deviceLabel } = require('./device');

/**
 * What services need to know about the request without depending on Express:
 * a device label for sessions and the activity log, and the language for emails.
 */
const requestContext = (req) => ({
  device: deviceLabel(req.get('user-agent')),
  locale: req.locale,
});

module.exports = requestContext;
