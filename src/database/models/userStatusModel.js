const mongoose = require('mongoose');

const userStatusSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['online', 'offline'],
        default: 'offline'
    }
});

const UserStatus = mongoose.model('UserStatus', userStatusSchema);

module.exports = UserStatus;
