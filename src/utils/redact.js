// Query parameters that carry single-use secrets (links from emails). Their values never reach a log line.
const SECRET_PARAMS = /([?&](?:token|code)=)[^&#]*/gi;

const redactUrl = (url) => String(url).replaceAll(SECRET_PARAMS, '$1[redacted]');

module.exports = { redactUrl };
