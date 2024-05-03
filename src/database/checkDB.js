const createUsersTable = require('./models/usersModel');
const createProductsTable = require('./models/productsModel');

async function checkAndCreateTables() {
    try {
        await createUsersTable;
        await createProductsTable;
        console.log('Tables checked and created successfully.');
    } catch (error) {
        console.error('Error checking and creating tables: ' + error.message);
    }
}

module.exports = checkAndCreateTables;
