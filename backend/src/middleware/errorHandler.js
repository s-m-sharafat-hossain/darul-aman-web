const { ZodError } = require('zod');
const { ApiError } = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * Central error handler. Never leaks stack traces or internal DB details
 * to the client in production — logs full detail server-side only.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (err instanceof ZodError ? 422 : 500);
  const logData = { message: err.message, statusCode };
  
  if (statusCode >= 500) {
    logData.stack = err.stack;
    logger.error(`[error] ${req.method} ${req.originalUrl}`, logData);
  } else {
    logger.warn(`[client-error] ${req.method} ${req.originalUrl}`, logData);
  }

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

  // Catch Prisma validation errors (e.g. Invalid Date, wrong data types)
  if (err.name === 'PrismaClientValidationError') {
    return res.status(400).json({
      success: false,
      error: { message: 'Database validation failed. Please check your payload structure and types.', details: err.message },
    });
  }
  
  if (err.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json({
      success: false,
      error: { message: 'Database request error.', details: err.message, code: err.code },
    });
  }

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
