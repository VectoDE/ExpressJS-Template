const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    price: {
        type: Number,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

const Product = mongoose.model('Product', ProductSchema);

async function createProduct({ name, description, price }) {
    try {
        const product = await Product.create({ name, description, price });
        return product;
    } catch (error) {
        throw error;
    }
}

async function getAllProducts() {
    try {
        const products = await Product.find();
        return products;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    createProduct,
    getAllProducts,
};
