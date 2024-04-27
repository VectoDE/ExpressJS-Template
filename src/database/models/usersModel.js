const connection = require('../connect');

function createUsersTable() {
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

function dropUsersTable() {
    const dropTableQuery = "DROP TABLE IF EXISTS users";
    connection.query(dropTableQuery, (err, results) => {
        if (err) {
            console.error('Error dropping users table: ' + err.stack);
            return;
        }
        console.log('Users table dropped successfully.');
    });
}

createUsersTable();

module.exports = {
    createUsersTable,
    dropUsersTable,
};
