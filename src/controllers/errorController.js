async function handleNotFound(req, res, next) {
    res.status(404).render('not_found', { pageTitle: 'Not Found', message: 'Sorry, the page you are looking for does not exist.' });
}

async function handleInternalError(err, req, res, next) {
    console.error(err.stack);
    res.status(500).render('error', { error: err });
}

module.exports = {
    handleNotFound,
    handleInternalError
};
