const connection = require('../connect');

function createProductsTable() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            price DECIMAL(10, 2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    connection.query(createTableQuery, (err, results) => {
        if (err) {
            console.error('Error creating products table: ' + err.stack);
            return;
        }
        console.log('Products table created successfully.');
    });
}

function dropProductsTable() {
    const dropTableQuery = "DROP TABLE IF EXISTS products";
    connection.query(dropTableQuery, (err, results) => {
        if (err) {
            console.error('Error dropping products table: ' + err.stack);
            return;
        }
        console.log('Products table dropped successfully.');
    });
}

createProductsTable();

module.exports = {
    createProductsTable,
    dropProductsTable,
};
