// Middleware to strip dangerous keys from JSON bodies before validation or database writes.
module.exports = function sanitize(req, res, next) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return next();
  }

  const cleaned = {};
  Object.keys(req.body).forEach((key) => {
    if (!key.startsWith('$') && !key.includes('.')) {
      cleaned[key] = req.body[key];
    }
  });

  req.body = cleaned;
  next();
};
