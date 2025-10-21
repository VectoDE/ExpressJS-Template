const mongoose = require('mongoose');
const { roles } = require('../config/roles');
const { hashPassword, comparePassword } = require('../utils/password');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      required: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
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
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function save(next) {
  if (!this.isModified('password')) {
    return next();
  }
  this.password = await hashPassword(this.password);
  return next();
});

userSchema.method('isPasswordMatch', function isPasswordMatch(password) {
  return comparePassword(password, this.password);
});

userSchema.static('isEmailTaken', async function isEmailTaken(email, excludeUserId) {
  const user = await this.findOne({ email, _id: { $ne: excludeUserId } });
  return !!user;
});

const User = mongoose.model('User', userSchema);

module.exports = User;
