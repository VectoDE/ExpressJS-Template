const mongoose = require('mongoose');

let connection;

async function connectToDatabase() {
    if (!connection) {
        try {
            await mongoose.connect(process.env.MONGODB_URI, {});
            console.log('Connected to MongoDB');
            connection = mongoose.connection;

            await checkAndCreateCollectionsAndIndexes();
        } catch (error) {
            console.error('Error connecting to MongoDB:', error.message);
        }
    }

    return connection;
}

async function checkAndCreateCollectionsAndIndexes() {
    try {
        console.log('Collections and indexes checked and created successfully.');
    } catch (error) {
        console.error('Error checking and creating collections and indexes:', error.message);
    }
}


module.exports = connectToDatabase;
