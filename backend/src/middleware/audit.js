const prisma = require('../config/db');

/**
 * Records a row in audit_logs. Called explicitly from controllers for
 * sensitive actions (spec §28: login/logout, student create/update,
 * admission approval, marks update, attendance modification, fee update,
 * payment, user creation, permission change, data deletion) rather than
 * blanket-logging every request, which would bury the signal in noise.
 *
 * Never throws — an audit-log failure must not block the underlying
 * business action.
 */
async function recordAudit({ req, action, entityType, entityId, before = null, after = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req?.user?.id || null,
        action,
        entityType,
        entityId: entityId ? String(entityId) : null,
        beforeData: before != null ? JSON.stringify(before) : null,
        afterData: after != null ? JSON.stringify(after) : null,
        ipAddress: req?.ip || null,
        userAgent: req?.headers?.['user-agent'] || null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to record audit log:', err.message);
  }
}

module.exports = { recordAudit };
