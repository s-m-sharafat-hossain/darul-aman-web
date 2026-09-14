const crypto = require('crypto');

/** Wraps an async route handler so rejected promises reach errorHandler. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Reads page/limit query params with sane defaults + hard ceiling. */
function getPagination(req) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function paginationMeta(total, page, limit) {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Generates a human-facing code, e.g. STU-2026-000231. This is an
 * identifier for display/reference (student/staff codes, invoice and
 * receipt numbers, certificate numbers) — not an auth token or anything
 * security-sensitive — but it still shouldn't come from a predictable PRNG
 * when a CSPRNG is just as easy to use, and crypto.randomInt gives an
 * unbiased draw from the range (Math.random()-based scaling can skew
 * slightly). Same format/range as before: a 6-digit suffix, 100000-999999.
 */
function generateCode(prefix) {
  const year = new Date().getFullYear();
  const rand = crypto.randomInt(100000, 1000000); // upper bound is exclusive -> 100000..999999
  return `${prefix}-${year}-${rand}`;
}

/**
 * Retries an operation whose only expected failure mode is a generated
 * code (student/staff code, invoice/receipt/certificate number, etc.)
 * colliding with an existing row — not a general-purpose retry-on-any-error
 * helper. Only retries when Prisma's unique-constraint violation (P2002)
 * names one of `uniqueColumns` as the cause; any other error — including a
 * P2002 on a genuinely duplicate user-supplied value like email or phone —
 * is rethrown immediately on the very first attempt, so a real conflict is
 * never silently retried or masked. Bounded at `retries` attempts: once
 * exhausted it rethrows the last error rather than looping forever, so a
 * persistent problem still surfaces (via the existing P2002 handler in
 * errorHandler.js) instead of hanging the request.
 *
 * `fn` should regenerate the code itself on every call (it's invoked once
 * per attempt), so each retry actually gets a new value to try.
 */
async function withCodeRetry(fn, uniqueColumns, retries = 5) {
  const columns = Array.isArray(uniqueColumns) ? uniqueColumns : [uniqueColumns];
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      const target = err?.meta?.target;
      const isCodeCollision = err?.code === 'P2002' && Array.isArray(target) && columns.some((c) => target.includes(c));
      if (!isCodeCollision) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}

module.exports = { asyncHandler, getPagination, paginationMeta, generateCode, withCodeRetry };
