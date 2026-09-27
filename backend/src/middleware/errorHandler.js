export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Server error" });
}
