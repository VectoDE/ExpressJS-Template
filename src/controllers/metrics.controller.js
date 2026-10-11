const config = require('../config/config');
const metrics = require('../utils/metrics');
const { safeEqual } = require('../utils/crypto');
const httpStatus = require('../utils/httpStatus');

/**
 * Prometheus endpoint. Without METRICS_TOKEN it does not exist (404); with it, scrapers must send
 * `Authorization: Bearer <token>`. Route names and timings are operational data, not for the public.
 */
const scrape = (req, res) => {
  if (!config.metrics.token) {
    return res.status(httpStatus.NOT_FOUND).json({ code: httpStatus.NOT_FOUND, message: 'Not found' });
  }
  const match = /^Bearer (.+)$/.exec(req.get('authorization') || '');
  if (!match || !safeEqual(match[1], config.metrics.token)) {
    res.set('WWW-Authenticate', 'Bearer');
    return res.status(httpStatus.UNAUTHORIZED).json({ code: httpStatus.UNAUTHORIZED, message: 'Unauthorized' });
  }
  return res.type('text/plain; version=0.0.4').send(metrics.render());
};

module.exports = { scrape };
