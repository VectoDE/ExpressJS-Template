const catchAsync = require('../../utils/catchAsync');
const userService = require('../../services/user.service');
const { addFlashMessage } = require('../../utils/flash');

const renderHome = (req, res) => {
  res.render('pages/site/home', {
    title: 'Enterprise Express Template',
    highlights: [
      'Mehrschichtige Architektur mit geprüften Sicherheitsstandards',
      'Sofort einsetzbare API-Dokumentation & Test-Suite',
      'Integrierte Weboberfläche mit CSRF- und Sitzungsschutz',
    ],
  });
};

const renderSecurity = (req, res) => {
  res.render('pages/site/security', {
    title: 'Security-Übersicht',
  });
};

const renderPrivacy = (req, res) => {
  res.render('pages/site/privacy', {
    title: 'Datenschutz',
  });
};

const renderDashboard = catchAsync(async (req, res) => {
  const sessionUser = req.session.user;
  if (!sessionUser) {
    addFlashMessage(req, {
      type: 'warning',
      text: 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.',
    });
    return res.redirect('/login');
  }

  const userDoc = await userService.getUserById(sessionUser.id);
  if (!userDoc) {
    addFlashMessage(req, {
      type: 'error',
      text: 'Dein Benutzerkonto konnte nicht gefunden werden.',
    });
    req.session.user = null;
    req.session.tokens = null;
    return res.redirect('/login');
  }

  const user = userService.toUserResponse(userDoc);
  req.session.user = user;

  return res.render('pages/site/dashboard', {
    title: 'Dashboard',
    user,
    tokens: req.session.tokens || null,
  });
});

module.exports = {
  renderHome,
  renderSecurity,
  renderPrivacy,
  renderDashboard,
};
