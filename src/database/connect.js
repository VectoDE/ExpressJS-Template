const mysql = require('mysql');
const usersModel = require('./models/usersModel');
const productsModel = require('./models/productsModel');

let connection; // Singleton für die Datenbankverbindung

function connectToDatabase() {
    if (!connection) {
        connection = mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        connection.connect((err) => {
            if (err) {
                console.error('Error connecting to database: ' + err.stack);
                return;
            }
            console.log('Connected to database as id ' + connection.threadId);

            // Nach erfolgreicher Verbindung die Tabellen überprüfen und erstellen
            checkAndCreateTables();
        });

        connection.on('error', (err) => {
            console.error('Database connection error: ' + err.stack);
        });
    }

    return connection;
}

async function checkAndCreateTables() {
    try {
        await usersModel.createUsersTable();
        await productsModel.createProductsTable();
        console.log('Tables checked and created successfully.');
    } catch (error) {
        console.error('Error checking and creating tables: ' + error.message);
    }
}

module.exports = connectToDatabase;
