const httpStatus = require('http-status');
const authValidation = require('../../validations/auth.validation');
const authService = require('../../services/auth.service');
const tokenService = require('../../services/token.service');
const userService = require('../../services/user.service');
const { addFlashMessage } = require('../../utils/flash');

const validate = (schema, payload) =>
  schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

const renderLogin = (req, res) => {
  res.render('pages/auth/login', {
    title: 'Anmelden',
  });
};

const renderRegister = (req, res) => {
  res.render('pages/auth/register', {
    title: 'Registrieren',
  });
};

const handleLogin = async (req, res, next) => {
  const { error, value } = validate(authValidation.login.body, req.body);
  if (error) {
    addFlashMessage(req, {
      type: 'error',
      text: error.details.map((detail) => detail.message).join(' '),
    });
    return res.redirect('/login');
  }

  value.email = value.email.toLowerCase();

  const redirectTo = req.session && req.session.returnTo ? req.session.returnTo : '/dashboard';
  const target = redirectTo;

  try {
    const user = await authService.loginWithEmailAndPassword(value.email, value.password);
    const tokens = await tokenService.generateAuthTokens(user);
    const safeUser = userService.toUserResponse(user);

    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        return next(regenerateError);
      }
      req.session.user = safeUser;
      req.session.tokens = tokens;
      delete req.session.returnTo;
      addFlashMessage(req, {
        type: 'success',
        text: `Willkommen zurück, ${safeUser.name || safeUser.email}!`,
      });
      req.session.save((saveError) => {
        if (saveError) {
          return next(saveError);
        }
        return res.redirect(target);
      });
    });
  } catch (err) {
    if (err.statusCode === httpStatus.UNAUTHORIZED) {
      addFlashMessage(req, {
        type: 'error',
        text: 'Ungültige Anmeldedaten. Bitte versuche es erneut.',
      });
      return res.redirect('/login');
    }
    return next(err);
  }

  return null;
};

const handleRegister = async (req, res, next) => {
  const { error, value } = validate(authValidation.register.body, req.body);
  if (error) {
    addFlashMessage(req, {
      type: 'error',
      text: error.details.map((detail) => detail.message).join(' '),
    });
    return res.redirect('/register');
  }

  value.role = 'user';
  value.email = value.email.toLowerCase();

  try {
    const user = await authService.registerUser(value);
    const tokens = await tokenService.generateAuthTokens(user);
    const safeUser = userService.toUserResponse(user);

    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        return next(regenerateError);
      }
      req.session.user = safeUser;
      req.session.tokens = tokens;
      delete req.session.returnTo;
      addFlashMessage(req, {
        type: 'success',
        text: 'Registrierung erfolgreich! Willkommen an Bord.',
      });
      req.session.save((saveError) => {
        if (saveError) {
          return next(saveError);
        }
        return res.redirect('/dashboard');
      });
    });
  } catch (err) {
    if (err.statusCode === httpStatus.BAD_REQUEST) {
      addFlashMessage(req, {
        type: 'error',
        text: err.message,
      });
      return res.redirect('/register');
    }
    return next(err);
  }

  return null;
};

const handleLogout = async (req, res, next) => {
  const refreshToken = req.session && req.session.tokens ? req.session.tokens.refresh.token : null;

  if (refreshToken) {
    try {
      await authService.logout(refreshToken);
    } catch (error) {
      if (!error.statusCode) {
        return next(error);
      }
    }
  }

  req.session.regenerate((regenerateError) => {
    if (regenerateError) {
      return next(regenerateError);
    }
    req.session.user = null;
    req.session.tokens = null;
    addFlashMessage(req, {
      type: 'success',
      text: 'Du wurdest sicher abgemeldet.',
    });
    req.session.save((saveError) => {
      if (saveError) {
        return next(saveError);
      }
      return res.redirect('/');
    });
  });
};

module.exports = {
  renderLogin,
  renderRegister,
  handleLogin,
  handleRegister,
  handleLogout,
};
