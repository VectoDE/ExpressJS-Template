const UserStatus = require('../database/models/userStatusModel');

const setUserOnline = async (userId) => {
    try {
        await UserStatus.findOneAndUpdate({ userId }, { status: 'online' }, { upsert: true });
    } catch (error) {
        console.error('Error setting user online:', error);
    }
};

const setUserOffline = async (userId) => {
    try {
        await UserStatus.findOneAndUpdate({ userId }, { status: 'offline' }, { upsert: true });
    } catch (error) {
        console.error('Error setting user offline:', error);
    }
};

const getUserStatus = async (userId) => {
    try {
        const userStatus = await UserStatus.findOne({ userId });
        return userStatus ? userStatus.status : 'offline';
    } catch (error) {
        console.error('Error getting user status:', error);
        return 'offline';
    }
};

module.exports = {
    setUserOnline,
    setUserOffline,
    getUserStatus,
};
