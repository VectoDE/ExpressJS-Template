const mysql = require('mysql');
const checkDB = require('./checkDB');

function connectToDatabase() {
    const connection = mysql.createConnection({
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

        // After connection established, call checkDB()
        checkDB();
    });

    connection.on('error', (err) => {
        console.error('Database connection error: ' + err.stack);
    });

    // Nur die Verbindungsfunktion zurückgeben, nicht das Verbindungsobjekt
    return connection;
}

module.exports = connectToDatabase;
