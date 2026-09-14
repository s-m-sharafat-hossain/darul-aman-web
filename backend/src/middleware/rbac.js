const prisma = require('../config/db');
const { ApiError } = require('../utils/apiResponse');

/**
 * Core permission check, usable both as route middleware (requirePermission,
 * below) and directly inside a controller when only one branch of a handler
 * needs the check — e.g. a route that mixes a self-service path (no
 * permission required, ownership-checked instead) with a staff path that
 * does need a permission. See fees.controller.recordPayment for that case.
 */
async function hasPermission(user, permissionCode) {
  if (!user) return false;

  // Super admin bypasses granular checks entirely by design.
  if (user.role === 'super_admin') return true;

  const [rolePerm, override] = await Promise.all([
    prisma.rolePermission.findFirst({
      where: {
        role: { name: user.role },
        permission: { code: permissionCode },
      },
    }),
    prisma.userPermissionOverride.findFirst({
      where: { userId: user.id, permission: { code: permissionCode } },
    }),
  ]);

  return override ? override.grantFlag : Boolean(rolePerm);
}

/**
 * Permission-based authorization: role grants a baseline set of
 * permissions; per-user overrides (user_permission_overrides) can add or
 * explicitly revoke individual permissions on top of that. Overrides always
 * win over the role default.
 *
 * Usage: router.post('/students', requireAuth, requirePermission('student.create'), handler)
 */
function requirePermission(permissionCode) {
  return async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required.');

      const allowed = await hasPermission(req.user, permissionCode);
      if (!allowed) {
        throw new ApiError(403, `Missing required permission: ${permissionCode}`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requirePermission, hasPermission };
