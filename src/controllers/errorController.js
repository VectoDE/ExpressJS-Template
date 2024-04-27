async function index (req, res) {
    res.render('error', {error: code, message});
};

async function handleNotFound(req, res, next) {
    res.status(404).send("Sorry, can't find that!");
}

async function handleInternalError(err, req, res, next) {
    console.error(err.stack);
    res.status(500).send('Something broke!');
}

module.exports = {
    index,
    handleNotFound,
    handleInternalError
};

