/**
 * Consistent response envelope across every endpoint, so the frontend can
 * rely on { success, data, meta, error } shape everywhere.
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function ok(res, data, meta = undefined, statusCode = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function created(res, data) {
  return ok(res, data, undefined, 201);
}

function noContent(res) {
  return res.status(204).send();
}

module.exports = { ApiError, ok, created, noContent };
