/**
 * One-time messages and form input that survive a single redirect (post/redirect/get).
 * Both live in the session and are removed when the next page reads them.
 */

const take = (req, key, fallback) => {
  if (req.session?.[key] === undefined) {
    return fallback;
  }
  const value = req.session[key];
  delete req.session[key];
  return value;
};

const addFlashMessage = (req, message) => {
  if (!req.session) {
    return;
  }
  req.session.flash = [...(Array.isArray(req.session.flash) ? req.session.flash : []), message];
};

const consumeFlashMessages = (req) => {
  const messages = take(req, 'flash', []);
  return Array.isArray(messages) ? messages : [];
};

// Keeps harmless fields (never passwords) so a form can be shown again with what the user typed.
const rememberInput = (req, values) => {
  if (req.session) {
    req.session.formInput = values;
  }
};

const consumeInput = (req) => take(req, 'formInput', {});

module.exports = {
  addFlashMessage,
  consumeFlashMessages,
  rememberInput,
  consumeInput,
};
