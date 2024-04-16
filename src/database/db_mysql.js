const mysql = require('mysql');

function connectToMySQL() {
    const connection = mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    });

    connection.connect((err) => {
        if (err) {
            console.error('Fehler beim Verbinden zur MySQL-Datenbank:', err.message);
            return null;
        }
        console.log('Verbindung zur MySQL-Datenbank erfolgreich hergestellt');
    });

    return connection;
}

module.exports = connectToMySQL;