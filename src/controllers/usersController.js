const userModel = require('../database/models/usersModel');

async function getUsers (req, res) {
    try {
        const users = await userModel.getAllUsers();
        res.json(users);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

async function createUser (req, res) {
    const userData = req.body;
    try {
        const newUser = await userModel.createUser(userData);
        res.status(201).json(newUser);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

async function getUserById (req, res) {
    const userId = req.params.id;
    try {
        const user = await userModel.getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error getting user by ID:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

async function updateUser (req, res) {
    const userId = req.params.id;
    const userData = req.body;
    try {
        const updatedUser = await userModel.updateUser(userId, userData);
        res.json(updatedUser);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

async function deleteUser (req, res) {
    const userId = req.params.id;
    try {
        await userModel.deleteUser(userId);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getUsers,
    createUser,
    getUserById,
    updateUser,
    deleteUser
};
