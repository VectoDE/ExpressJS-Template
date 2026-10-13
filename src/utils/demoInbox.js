// SPDX-FileCopyrightText: 2024-2026 VectoDE
// SPDX-License-Identifier: MIT

const { AsyncLocalStorage } = require('node:async_hooks');

/**
 * Demo mode only (DEMO_MODE=true): emails are not sent. The email service hands them to the browser session of
 * the request that caused them, and the next page shows them, link included. Outside demo mode the middleware
 * is never mounted and nothing here runs.
 */
const MAX_MAILS = 5;
const storage = new AsyncLocalStorage();

// Remembers the current request for everything that runs on its behalf, also across awaits.
const trackRequest = (req, res, next) => storage.run(req, next);

// Returns false when there is no browser session to show the mail in (API calls, background jobs).
const deliver = (mail) => {
  const req = storage.getStore();
  if (!req?.session) {
    return false;
  }
  const mails = Array.isArray(req.session.demoMail) ? req.session.demoMail : [];
  req.session.demoMail = [...mails, mail].slice(-MAX_MAILS);
  return true;
};

const consume = (req) => {
  const mails = req.session?.demoMail;
  if (mails === undefined) {
    return [];
  }
  delete req.session.demoMail;
  return Array.isArray(mails) ? mails : [];
};

module.exports = { trackRequest, deliver, consume };
