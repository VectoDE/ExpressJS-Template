require('dotenv').config();
const mysqlDB = require('./db_mysql');
const mongodbDB = require('./db_mongodb');

module.exports = () => {
    const databaseType = process.env.DATABASE_TYPE;
    if (databaseType === 'mongodb') {
        return mongodbDB();
    } else if (databaseType === 'mysql') {
        return mysqlDB();
    } else {
        console.error('Ungültiger Datenbanktyp in der Umgebungsvariable DATABASE_TYPE:', databaseType);
        return null;
    }
};
