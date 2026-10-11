const path = require('node:path');
const ejs = require('ejs');
const nodemailer = require('nodemailer');
const config = require('../config/config');
const logger = require('../config/logger');
const i18n = require('../i18n');

/**
 * Transactional emails in the language of the account. With SMTP_URL set, mails go out over SMTP.
 * Without it (development and tests only, production refuses to start) nodemailer's JSON transport is used:
 * nothing leaves the machine, development logs the text with its link and tests read the outbox.
 * Production refuses SMTP servers that offer no TLS; a local test server without TLS still works in development.
 */
const transport = nodemailer.createTransport({
  ...(config.mail.smtpUrl ? { url: config.mail.smtpUrl } : { jsonTransport: true }),
  requireTLS: config.isProduction,
});

const OUTBOX_SIZE = 20;
const outbox = [];

const TEMPLATE = path.join(__dirname, '../views/emails/message.ejs');
const forgotPasswordUrl = () => `${config.appUrl}/forgot-password`;

// What each email says. `action` is the button, `notYou` adds the "was this not you?" hint with the reset link.
const MESSAGES = {
  verifyEmail: ({ token }) => ({
    action: { url: `${config.appUrl}/verify-email?token=${encodeURIComponent(token)}` },
    outroVars: { hours: config.auth.verifyEmailExpirationHours },
  }),
  resetPassword: ({ token }) => ({
    action: { url: `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}` },
    outroVars: { minutes: config.auth.resetPasswordExpirationMinutes },
  }),
  passwordChanged: () => ({ notYou: true }),
  emailChanged: ({ newEmail }) => ({ introVars: { email: newEmail }, notYou: true }),
  accountLocked: () => ({ introVars: { minutes: Math.round(config.login.lockMs / 60000) }, notYou: true }),
  twoFactorEnabled: () => ({ notYou: true }),
  twoFactorDisabled: () => ({ notYou: true }),
};

const compose = async (template, { name, locale, ...data }) => {
  const { t, locale: resolved } = i18n.forLocale(locale);
  const spec = MESSAGES[template](data);
  const key = (part) => `emails.${template}.${part}`;
  const content = {
    lang: resolved,
    subject: t(key('subject')),
    greeting: t('emails.greeting', { name }),
    intro: t(key('intro'), spec.introVars),
    action: spec.action ? { label: t(key('action')), url: spec.action.url } : null,
    outro: spec.outroVars ? t(key('outro'), spec.outroVars) : null,
    notYou: spec.notYou ? { text: t('emails.notYou'), url: forgotPasswordUrl() } : null,
    signature: t('emails.signature', { app: config.appName }),
  };
  const text = [
    content.greeting,
    content.intro,
    content.action && `${content.action.label}:\n${content.action.url}`,
    content.outro,
    content.notYou && `${content.notYou.text}\n${content.notYou.url}`,
    `-- \n${content.signature}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  const html = await ejs.renderFile(TEMPLATE, content);
  return { subject: content.subject, text, html };
};

const send = async (template, to, data) => {
  const { subject, text, html } = await compose(template, data);
  const info = await transport.sendMail({ from: config.mail.from, to, subject, text, html });
  if (!config.mail.smtpUrl) {
    outbox.push({ template, to, subject, text, html, sentAt: new Date() });
    outbox.splice(0, Math.max(outbox.length - OUTBOX_SIZE, 0));
    if (config.env === 'development') {
      logger.info('Email "%s" not sent (SMTP_URL is empty). Content:\n%s', subject, text);
    }
  }
  return info;
};

/**
 * Fire and forget for requests that must answer at once and must not reveal by their timing whether
 * an email was sent (forgot password). Failures are logged, never thrown.
 */
const sendInBackground = (template, to, data) => {
  send(template, to, data).catch((error) => {
    logger.error('Email "%s" could not be sent: %s', template, error.message);
  });
};

// For an account document: address, name and language come from the user.
const notify = (user, template, data = {}) =>
  sendInBackground(template, data.to || user.email, { name: user.name, locale: user.locale, ...data });

const verifyConnection = () => (config.mail.smtpUrl ? transport.verify() : Promise.resolve(true));

module.exports = {
  compose,
  send,
  sendInBackground,
  notify,
  outbox,
  verifyConnection,
  TEMPLATES: Object.keys(MESSAGES),
};
