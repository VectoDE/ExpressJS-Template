const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        default: 'user'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model('User', UserSchema);

async function createUser({ username, email, password, role = 'user' }) {
    try {
        const user = await User.create({ username, email, password, role });
        return user;
    } catch (error) {
        throw error;
    }
}

async function getAllUsers() {
    try {
        const users = await User.find();
        return users;
    } catch (error) {
        throw error;
    }
}

async function getUserByEmail(email) {
    try {
        const user = await User.findOne({ email });
        return user;
    } catch (error) {
        throw error;
    }
}

async function getUserByUsername(username) {
    try {
        const user = await User.findOne({ username });
        return user;
    } catch (error) {
        throw error;
    }
}

async function getUserByRole(role) {
    try {
        const users = await User.find({ role });
        return users;
    } catch (error) {
        throw error;
    }
}

async function verifyUser(userId) {
    try {
        const user = await User.findByIdAndUpdate(userId, { isVerified: true }, { new: true });
        return user;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    createUser,
    getAllUsers,
    getUserByEmail,
    getUserByUsername,
    getUserByRole,
    verifyUser,
};
