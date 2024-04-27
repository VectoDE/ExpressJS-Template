const userModel = require('../database/models/usersModel');
const productModel = require('../database/models/productsModel');

async function getAPI (req, res) {
    res.render('api');
};

async function getAllUsers(req, res) {
    try {
        const users = await userModel.getAllUsers();
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getUserById(req, res) {
    const userId = req.params.id;
    try {
        const user = await userModel.getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user by ID:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getUserByUsername(req, res) {
    const username = req.params.username;
    try {
        const user = await userModel.getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user by username:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getUserByEmail(req, res) {
    const email = req.params.email;
    try {
        const user = await userModel.getUserByEmail(email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user by email:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getAllProducts(req, res) {
    try {
        const products = await productModel.getAllProducts();
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getProductById(req, res) {
    const productId = req.params.id;
    try {
        const product = await productModel.getProductById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        console.error('Error fetching product by ID:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getProductByName(req, res) {
    const productName = req.params.name;
    try {
        const product = await productModel.getProductByName(productName);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        console.error('Error fetching product by name:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    getAPI,
    getAllUsers,
    getUserById,
    getUserByUsername,
    getUserByEmail,
    getAllProducts,
    getProductById,
    getProductByName
};
