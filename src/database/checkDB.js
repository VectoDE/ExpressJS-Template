const connection = require('./connect');

async function createUsersTable() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    connection.query(createTableQuery, (err, results) => {
        if (err) {
            console.error('Error creating users table: ' + err.stack);
            return;
        }
        console.log('Users table created successfully.');
    });
}

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
    connection.query(createTableQuery, (err, results) => {
        if (err) {
            console.error('Error creating products table: ' + err.stack);
            return;
        }
        console.log('Products table created successfully.');
    });
}

async function checkAndCreateTables() {
    connection.query("SHOW TABLES LIKE 'users'", (err, userResults) => {
        if (err) {
            console.error('Error checking users table existence: ' + err.stack);
            return;
        }
        if (userResults.length === 0) {
            // Tabelle users existiert nicht, erstelle sie
            createUsersTable();
        } else {
            // Tabelle users existiert bereits
            console.log('Users table already exists.');
        }
    });

    connection.query("SHOW TABLES LIKE 'products'", (err, productResults) => {
        if (err) {
            console.error('Error checking products table existence: ' + err.stack);
            return;
        }
        if (productResults.length === 0) {
            // Tabelle products existiert nicht, erstelle sie
            createProductsTable();
        } else {
            // Tabelle products existiert bereits
            console.log('Products table already exists.');
        }
    });
}

checkAndCreateTables();

module.exports = connection;
