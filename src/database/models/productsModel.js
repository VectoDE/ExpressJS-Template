const connection = require('../connect');

async function createProductsTable() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            price DECIMAL(10, 2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    return new Promise((resolve, reject) => {
        connection.query(createTableQuery, (err, results) => {
            if (err) {
                reject('Error creating products table: ' + err.stack);
                return;
            }
            resolve('Products table created successfully.');
        });
    });
}

async function dropProductsTable() {
    const dropTableQuery = "DROP TABLE IF EXISTS products";
    return new Promise((resolve, reject) => {
        connection.query(dropTableQuery, (err, results) => {
            if (err) {
                reject('Error dropping products table: ' + err.stack);
                return;
            }
            resolve('Products table dropped successfully.');
        });
    });
}

async function getAllProducts() {
    const query = "SELECT * FROM products";
    return new Promise((resolve, reject) => {
        connection.query(query, (err, results) => {
            if (err) {
                reject('Error fetching products: ' + err.stack);
                return;
            }
            resolve(results);
        });
    });
}

module.exports = {
    createProductsTable,
    dropProductsTable,
    getAllProducts,
};
