const { ZodError } = require('zod');
const { ApiError } = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * Central error handler. Never leaks stack traces or internal DB details
 * to the client in production — logs full detail server-side only.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(`[error] ${req.method} ${req.originalUrl}`, {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
  });

  if (err instanceof ZodError) {
    return res.status(422).json({
      success: false,
      error: { message: 'Validation failed.', details: err.errors },
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { message: err.message, details: err.details },
    });
  }

  // Prisma known error codes worth surfacing distinctly.
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: { message: 'A record with this value already exists.', details: err.meta },
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: { message: 'Record not found.' },
    });
  }

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    error: {
      message: statusCode === 500 ? 'Internal server error.' : err.message,
    },
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: { message: 'Route not found.' } });
}

module.exports = { errorHandler, notFoundHandler };
