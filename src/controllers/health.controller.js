const mongoose = require('mongoose');
const httpStatus = require('../utils/httpStatus');

// Liveness: the process answers. No uptime, versions or hostnames are exposed.
const liveness = (req, res) => {
  res.status(httpStatus.OK).json({ status: 'ok' });
};

// Readiness: the database is connected, so a load balancer only routes traffic that can be served.
const readiness = (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res
    .status(ready ? httpStatus.OK : httpStatus.SERVICE_UNAVAILABLE)
    .json({ status: ready ? 'ok' : 'unavailable', database: ready ? 'up' : 'down' });
};

module.exports = {
  liveness,
  readiness,
};
