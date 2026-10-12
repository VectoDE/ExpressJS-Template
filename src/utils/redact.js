// Query parameters that carry single-use secrets (links from emails). Their values never reach a log line.
const SECRET_PARAMS = /([?&](?:token|code)=)[^&#]*/gi;

const redactUrl = (url) => String(url).replaceAll(SECRET_PARAMS, '$1[redacted]');

// Request data in log lines stays on one line, so nobody can forge an extra log entry with CR/LF.
const oneLine = (value) => String(value).replaceAll(/[\r\n]+/g, ' | ');

module.exports = { redactUrl, oneLine };
