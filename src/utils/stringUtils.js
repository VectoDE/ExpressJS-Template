exports.truncate = function(text, maxLength) {
    if (text.length > maxLength) {
        return text.substring(0, maxLength) + '...';
    }
    return text;
};

// Beispiel: Funktion zum Umdrehen einer Zeichenkette
exports.reverse = function(text) {
    return text.split('').reverse().join('');
};