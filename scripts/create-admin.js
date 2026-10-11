/**
 * Creates an administrator account, or promotes an existing account to administrator.
 * Asks for name, email and password on the terminal; the password is not echoed.
 *
 *   npm run create-admin
 *   ADMIN_NAME=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run create-admin   (non-interactive, e.g. in CI)
 */
const readline = require('node:readline');

const ask = (question, { hidden = false } = {}) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Print the prompt once, then swallow every echoed keystroke.
      rl._writeToOutput = (text) => {
        if (text.includes(question)) rl.output.write(text);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });

const main = async () => {
  const Joi = require('joi');
  const { fields } = require('../src/validations/custom.validation');
  const mongoose = require('../src/config/mongoose');
  const User = require('../src/models/user.model');

  const name = process.env.ADMIN_NAME || (await ask('Name: '));
  const email = (process.env.ADMIN_EMAIL || (await ask('Email: '))).toLowerCase();
  const { error: emailError } = Joi.string().email().validate(email);
  if (emailError) throw new Error('That is not a valid email address.');

  await mongoose.connect();
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role === 'admin') {
        process.stdout.write(`${email} is already an administrator.\n`);
        return;
      }
      existing.role = 'admin';
      existing.credentialsChangedAt = new Date();
      await existing.save();
      process.stdout.write(`${email} is now an administrator. Existing sessions of this account were ended.\n`);
      return;
    }
    const { error: nameError } = fields.name().validate(name);
    if (nameError) throw new Error('The name must be 3 to 120 characters long.');
    const password = process.env.ADMIN_PASSWORD || (await ask('Password (12+ characters, mixed): ', { hidden: true }));
    const { error: passwordError } = fields.newPassword().required().validate(password);
    if (passwordError) throw new Error(passwordError.message);
    await User.create({ name, email, password, role: 'admin', isEmailVerified: true });
    process.stdout.write(`Administrator ${email} created. Sign in at /login.\n`);
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
