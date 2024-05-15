async function getIndex(req, res) {
    const pageTitle = "Home Page";
    const content = "Welcome to our website! We provide services for all your needs.";
    res.render('index', { pageTitle, content });
}

async function getAbout(req, res) {
    const pageTitle = "About Us";
    const content = "Learn more about our company and our mission.";
    res.render('about', { pageTitle, content });
}

async function getContact(req, res) {
    const pageTitle = "Contact Us";
    const content = "Get in touch with us. We'd love to hear from you!";
    res.render('contact', { pageTitle, content });
}

async function getLogin(req, res) {
    const pageTitle = "Login";
    const content = "Log into your account!";
    res.render('auth/login', { pageTitle, content });
}

async function getRegister(req, res) {
    const pageTitle = "Register";
    const content = "Register yourself!";
    res.render('auth/register', { pageTitle, content });
}

module.exports = {
    getIndex,
    getAbout,
    getContact,
    getLogin,
    getRegister,
};
