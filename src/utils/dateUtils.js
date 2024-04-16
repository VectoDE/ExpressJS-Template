exports.formatDate = function(date) {
    return date.toLocaleDateString('de-DE');
};

// Beispiel: Funktion zum Berechnen der Anzahl der Tage zwischen zwei Daten
exports.calculateDaysDifference = function(startDate, endDate) {
    const diff = endDate.getTime() - startDate.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};