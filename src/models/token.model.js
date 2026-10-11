const mongoose = require('mongoose');
const { tokenTypes } = require('../config/tokens');

const tokenSchema = new mongoose.Schema(
  {
    // SHA-256 of the token. A database leak does not hand out usable refresh tokens.
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    expires: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(tokenTypes),
      required: true,
    },
    // Refresh tokens: one family per sign-in. Rotation keeps the family, so it identifies a session.
    family: {
      type: String,
    },
    // Short device label for the session list, derived from the User-Agent. No IP addresses are stored.
    device: {
      type: String,
      maxlength: 120,
    },
    // Refresh tokens: when the session (family) started. Rotation copies it to the new token.
    startedAt: {
      type: Date,
    },
    // Email verification: the address the link was sent to, so a later email change invalidates it.
    email: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

tokenSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });
tokenSchema.index({ user: 1, type: 1 });

const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;
