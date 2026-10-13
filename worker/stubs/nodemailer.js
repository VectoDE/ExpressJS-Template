// SPDX-FileCopyrightText: 2024-2026 VectoDE
// SPDX-License-Identifier: MIT

/**
 * Replaces nodemailer in the Worker bundle. The demo runs with DEMO_MODE, where the email service shows messages
 * on the page and never hands them to a transport; this keeps SMTP code out of the Worker.
 */
const createTransport = () => ({
  sendMail: async () => {
    throw new Error('The Cloudflare demo does not send emails');
  },
  verify: async () => true,
});

module.exports = { createTransport };
