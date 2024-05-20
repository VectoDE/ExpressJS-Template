const Role = require('../database/models/roleModel.js');

async function createRole(req, res) {
    try {
        const { name, description, permissions } = req.body;
        const role = new Role({ name, description, permissions });
        await role.save();
        res.status(201).json({ message: 'Role created successfully', role });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create role', error: error.message });
    }
}

async function getAllRoles(req, res) {
    try {
        const roles = await Role.find();
        res.json(roles);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch roles', error: error.message });
    }
}

async function getRoleById(req, res) {
    try {
        const role = await Role.findById(req.params.id);
        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }
        res.json(role);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch role', error: error.message });
    }
}

async function updateRole(req, res) {
    try {
        const { name, description, permissions } = req.body;
        const role = await Role.findByIdAndUpdate(req.params.id, { name, description, permissions }, { new: true });
        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }
        res.json({ message: 'Role updated successfully', role });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update role', error: error.message });
    }
}

async function deleteRole(req, res) {
    try {
        const role = await Role.findByIdAndDelete(req.params.id);
        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }
        res.json({ message: 'Role deleted successfully', role });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete role', error: error.message });
    }
}

module.exports = {
    createRole,
    getAllRoles,
    getRoleById,
    updateRole,
    deleteRole
};
