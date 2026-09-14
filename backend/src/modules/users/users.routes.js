const express = require('express');
const controller = require('./users.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');

const router = express.Router();
router.use(requireAuth);

// User management
router.get('/', requirePermission('user.view'), controller.listUsers);
router.post('/', requireRole('super_admin', 'admin'), controller.createUser);
router.patch('/:id/disable', requireRole('super_admin', 'admin'), controller.disableUser);
router.patch('/:id/activate', requireRole('super_admin', 'admin'), controller.activateUser);
router.post('/:id/reset-password', requireRole('super_admin', 'admin'), controller.resetUserPassword);
router.patch('/:id/role', requireRole('super_admin'), controller.assignRole);
router.post('/:id/permission-overrides', requireRole('super_admin'), controller.setPermissionOverride);

// Roles & permissions catalogue — super admin only (spec §26)
router.get('/roles', requireRole('super_admin', 'admin'), controller.listRoles);
router.get('/permissions', requireRole('super_admin', 'admin'), controller.listPermissions);
router.put('/roles/:roleId/permissions', requireRole('super_admin'), controller.setRolePermissions);

// Audit log viewer
router.get('/audit-logs', requireRole('super_admin', 'admin'), controller.listAuditLogs);

module.exports = router;
