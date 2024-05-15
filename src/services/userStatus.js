const userStatus = {};

const setUserOnline = (userId) => {
    userStatus[userId] = 'online';
};

const setUserOffline = (userId) => {
    userStatus[userId] = 'offline';
};

const getUserStatus = (userId) => {
    return userStatus[userId] || 'offline';
};

module.exports = {
    setUserOnline,
    setUserOffline,
    getUserStatus,
};
