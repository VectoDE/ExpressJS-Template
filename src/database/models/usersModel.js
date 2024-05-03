const connection = require('../connect');

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

    try {
        await new Promise((resolve, reject) => {
            connection.query(createTableQuery, (err, results) => {
                if (err) {
                    reject('Error creating users table: ' + err.stack);
                    return;
                }
                resolve('Users table created successfully.');
            });
        });
    } catch (error) {
        throw error;
    }
}

async function dropUsersTable() {
    const dropTableQuery = "DROP TABLE IF EXISTS users";

    try {
        await new Promise((resolve, reject) => {
            connection.query(dropTableQuery, (err, results) => {
                if (err) {
                    reject('Error dropping users table: ' + err.stack);
                    return;
                }
                resolve('Users table dropped successfully.');
            });
        });
    } catch (error) {
        throw error;
    }
}

async function getAllUsers() {
    const query = "SELECT * FROM users";

    try {
        const users = await new Promise((resolve, reject) => {
            connection.query(query, (err, results) => {
                if (err) {
                    reject('Error fetching users: ' + err.stack);
                    return;
                }
                resolve(results);
            });
        });
        return users;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    createUsersTable,
    dropUsersTable,
    getAllUsers,
};
