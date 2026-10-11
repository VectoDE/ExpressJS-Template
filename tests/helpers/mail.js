const emailService = require('../../src/services/email.service');

/**
 * Emails go out in the background, so tests wait for them. Without SMTP_URL the JSON transport keeps
 * every message in the outbox instead of sending it.
 */
const waitForMail = async (predicate, timeoutMs = 3000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const mail = emailService.outbox.find(predicate);
    if (mail) {
      return mail;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Expected email was not sent');
};

const mailTo = (address, template) => (mail) => mail.to === address && (!template || mail.template === template);

// The token from the link in an email (?token=...).
const tokenFrom = (mail) => /[?&]token=([A-Za-z0-9_-]+)/.exec(mail.text)[1];

const clearOutbox = () => emailService.outbox.splice(0, emailService.outbox.length);

module.exports = { waitForMail, mailTo, tokenFrom, clearOutbox };
