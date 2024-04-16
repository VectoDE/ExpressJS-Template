const mongoose = require('mongoose');

function connectToMongoDB() {
    const mongodbURL = process.env.MONGODB_URL;

    if (!mongodbURL) {
        console.error('Die Umgebungsvariable MONGODB_URL ist nicht definiert.');
        process.exit(1);
    }

    mongoose.connect(mongodbURL, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => {
        console.log('Verbindung zur MongoDB erfolgreich hergestellt');
    })
    .catch((err) => {
        console.error('Fehler beim Verbinden zur MongoDB:', err.message);
    });

    return mongoose.connection;
}

module.exports = connectToMongoDB;
