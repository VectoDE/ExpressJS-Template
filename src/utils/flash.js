const ensureFlashBucket = (req) => {
  if (!req.session) {
    return [];
  }
  if (!req.session.flash) {
    req.session.flash = [];
  }
  return req.session.flash;
};

const addFlashMessage = (req, message) => {
  if (!req.session) {
    return;
  }
  const bucket = ensureFlashBucket(req);
  bucket.push(message);
};

const consumeFlashMessages = (req) => {
  if (!req.session) {
    return [];
  }
  const messages = Array.isArray(req.session.flash) ? [...req.session.flash] : [];
  delete req.session.flash;
  return messages;
};

module.exports = {
  addFlashMessage,
  consumeFlashMessages,
};
