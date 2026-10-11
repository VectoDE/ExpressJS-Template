/**
 * Writes a changed session to the store before a redirect goes out.
 *
 * express-session saves at the end of the response and only holds back the last byte of the body until the
 * store confirms. Browsers follow a redirect as soon as the headers arrive, so the next request can read the
 * session before the write landed: a pending two-factor sign-in or a flash message would then be missing.
 * Saving first closes that gap. express-session sees the session as saved and does not write it twice.
 * Unchanged sessions are left alone, so visitors who never got a session still do not get one.
 */
const snapshot = (session) => (session ? JSON.stringify({ ...session, cookie: undefined }) : null);

const saveSessionBeforeRedirect = (req, res, next) => {
  const before = snapshot(req.session);
  const redirect = res.redirect.bind(res);
  res.redirect = (...args) => {
    if (!req.session || snapshot(req.session) === before) {
      redirect(...args);
      return;
    }
    req.session.save((error) => {
      if (error) {
        next(error);
        return;
      }
      redirect(...args);
    });
  };
  next();
};

module.exports = saveSessionBeforeRedirect;
