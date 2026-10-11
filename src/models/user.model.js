const mongoose = require('mongoose');
const config = require('../config/config');
const { roles } = require('../config/roles');
const { hashPassword, comparePassword } = require('../utils/password');

const PUBLIC_FIELDS = ['name', 'email', 'role', 'isEmailVerified', 'locale', 'createdAt', 'updatedAt'];

const LOCALES = ['en', 'de'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
      maxlength: 120,
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      required: true,
      maxlength: 254,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: roles,
      default: 'user',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    // Language for emails and the browser UI after sign-in.
    locale: {
      type: String,
      enum: LOCALES,
      default: () => config.defaultLocale,
    },
    // Time-based one-time passwords. Secrets are encrypted (utils/crypto), recovery codes stored as SHA-256.
    twoFactor: {
      type: new mongoose.Schema(
        {
          enabled: { type: Boolean, default: false },
          secret: { type: String },
          pendingSecret: { type: String },
          lastUsedStep: { type: Number, default: -1 },
          recoveryCodes: { type: [String], default: [] },
          enabledAt: { type: Date },
        },
        { _id: false }
      ),
      default: () => ({}),
      select: false,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lockUntil: {
      type: Date,
      select: false,
    },
    // Tokens and sessions issued before this moment are rejected.
    credentialsChangedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    timestamps: true,
    // Defence in depth: even an accidental res.json(user) never contains a secret.
    toJSON: {
      transform: (doc, ret) => {
        ['password', 'twoFactor', 'failedLoginAttempts', 'lockUntil', '__v'].forEach((field) => delete ret[field]);
        return ret;
      },
    },
  }
);

userSchema.pre('save', async function hashOnChange() {
  if (this.isModified('password')) {
    this.password = await hashPassword(this.password);
  }
  if (!this.isNew && (this.isModified('password') || this.isModified('role') || this.isModified('email'))) {
    this.credentialsChangedAt = new Date();
  }
});

userSchema.method('isPasswordMatch', function isPasswordMatch(password) {
  return comparePassword(password, this.password);
});

userSchema.method('toPublic', function toPublic() {
  const user = { id: this.id };
  PUBLIC_FIELDS.forEach((field) => {
    if (this[field] !== undefined) {
      user[field] = this[field];
    }
  });
  // Only a flag leaves the model; the secret and recovery codes never do.
  if (this.isSelected('twoFactor')) {
    user.twoFactorEnabled = Boolean(this.twoFactor?.enabled);
  }
  return user;
});

userSchema.static('isEmailTaken', async function isEmailTaken(email, excludeUserId) {
  const filter = { email: String(email).toLowerCase() };
  if (excludeUserId) {
    filter._id = mongoose.trusted({ $ne: excludeUserId });
  }
  return Boolean(await this.exists(filter));
});

const User = mongoose.model('User', userSchema);
User.LOCALES = LOCALES;

module.exports = User;
