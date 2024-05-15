const { connection } = require('../connect');

async function createUsersTable() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'user',
            isVerified BOOLEAN DEFAULT FALSE,
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
        connection.end(); // Verbindung schließen
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

async function createUser({ username, email, password, role = 'user' }) {
    const query = 'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)';

    try {
        await new Promise((resolve, reject) => {
            connection.query(query, [username, email, password, role], (err, results) => {
                if (err) {
                    reject('Error creating user: ' + err.stack);
                    return;
                }
                resolve(results);
            });
        });
    } catch (error) {
        throw error;
    }
}

async function getUserByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = ?';

    try {
        const user = await new Promise((resolve, reject) => {
            connection.query(query, [email], (err, results) => {
                if (err) {
                    reject('Error fetching user by email: ' + err.stack);
                    return;
                }
                resolve(results[0]);
            });
        });
        return user;
    } catch (error) {
        throw error;
    }
}

async function getUserByUsername(username) {
    const query = 'SELECT * FROM users WHERE username = ?';

    try {
        const user = await new Promise((resolve, reject) => {
            connection.query(query, [username], (err, results) => {
                if (err) {
                    reject('Error fetching user by username: ' + err.stack);
                    return;
                }
                resolve(results[0]);
            });
        });
        return user;
    } catch (error) {
        throw error;
    }
}

async function getUserByRole(role) {
    const query = 'SELECT * FROM users WHERE role = ?';

    try {
        const users = await new Promise((resolve, reject) => {
            connection.query(query, [role], (err, results) => {
                if (err) {
                    reject('Error fetching users by role: ' + err.stack);
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

async function verifyUser(userId) {
    const query = 'UPDATE users SET isVerified = TRUE WHERE id = ?';

    try {
        await new Promise((resolve, reject) => {
            connection.query(query, [userId], (err, results) => {
                if (err) {
                    reject('Error verifying user: ' + err.stack);
                    return;
                }
                resolve(results);
            });
        });
    } catch (error) {
        throw error;
    }
}

module.exports = {
    createUsersTable,
    dropUsersTable,
    getAllUsers,
    createUser,
    getUserByEmail,
    getUserByUsername,
    getUserByRole,
    verifyUser,
};
