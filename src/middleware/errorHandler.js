/**
 * Express error handler middleware.
 */
const errorHandler = (err, req, res, next) => {
  const requestId = req.requestId || res.locals.requestId;
  let error = { ...err };
  error.message = err.message;

  console.error('[API ERROR]', {
    requestId,
    path: req.originalUrl,
    method: req.method,
    message: err.message,
    stack: err.stack,
    name: err.name,
    statusCode: err.statusCode,
  });

  if (err.name === 'CastError') {
    error = { message: 'Resource not found', statusCode: 404 };
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'resource';
    error = { message: `${field} already exists`, statusCode: 400 };
  }

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors || {})
      .map((value) => value.message)
      .join(', ');
    error = { message, statusCode: 400 };
  }

  if (err.name === 'JsonWebTokenError') {
    error = { message: 'Invalid token', statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    error = { message: 'Token expired', statusCode: 401 };
  }

  const statusCode = error.statusCode || err.statusCode || 500;
  const message = error.message || 'Server Error';

  return res.status(statusCode).json({
    success: false,
    message,
    requestId,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default errorHandler;
