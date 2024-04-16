const mysql = require('mysql');

const dbConnection = mysql.createConnection('../database/connect');

const getUsers = (callback) => {
  const query = 'SELECT * FROM users';
  dbConnection.query(query, (err, results) => {
    if (err) {
      console.error('Fehler beim Abrufen der Benutzerdaten:', err);
      callback(err, null);
      return;
    }
    callback(null, results);
  });
};

module.exports = getUsers;