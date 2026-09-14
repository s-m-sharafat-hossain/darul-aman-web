const { verifyAccessToken } = require('../utils/jwt');
const { ApiError } = require('../utils/apiResponse');
const prisma = require('../config/db');

/**
 * Requires a valid access token. Attaches req.user = { id, role, userCode }.
 * Re-checks the user is still active in the DB on every request — a
 * disabled account is locked out immediately, not just at next token expiry.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) throw new ApiError(401, 'Authentication required.');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      throw new ApiError(401, 'Invalid or expired token.');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, role: { select: { name: true } }, userCode: true },
    });

    if (!user || !user.isActive) {
      throw new ApiError(401, 'Account is inactive or no longer exists.');
    }

    req.user = { id: user.id, role: user.role.name, userCode: user.userCode };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Restricts a route to a fixed set of role names. This is a coarse gate —
 * use requirePermission() for fine-grained module/action checks. Both exist
 * because some routes (e.g. "/admin/*") are naturally role-scoped, while
 * others (e.g. "approve fee discount") are naturally permission-scoped.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Authentication required.'));
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to access this resource.'));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
