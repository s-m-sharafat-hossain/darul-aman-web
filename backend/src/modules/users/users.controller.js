const { z } = require('zod');
const prisma = require('../../config/db');
const { hashPassword, generateSecurePassword, validatePasswordStrength } = require('../../utils/password');
const { ApiError, ok, created } = require('../../utils/apiResponse');
const { asyncHandler, getPagination, paginationMeta, generateCode, withCodeRetry } = require('../../utils/helpers');
const { recordAudit } = require('../../middleware/audit');

const createUserSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(8).optional(), // auto-generated if omitted
  roleName: z.string(),
});

const updateRoleSchema = z.object({ roleName: z.string() });
const permissionOverrideSchema = z.object({ permissionCode: z.string(), grant: z.boolean() });

const listUsers = asyncHandler(async (req, res) => {
  const pagination = getPagination(req);
  const where = {};
  if (req.query.roleName) where.role = { name: req.query.roleName };
  if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true';
  if (req.query.search) {
    where.OR = [
      { userCode: { contains: req.query.search } },
      { email: { contains: req.query.search } },
      { phone: { contains: req.query.search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where, skip: pagination.skip, take: pagination.limit,
      select: { id: true, userCode: true, email: true, phone: true, isActive: true, lastLoginAt: true, role: { select: { name: true } }, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);
  return ok(res, items, paginationMeta(total, pagination.page, pagination.limit));
});

/** Creates a bare login (used for roles like accountant/receptionist/librarian that aren't tied to a staff/teacher/student/guardian profile record). */
const createUser = asyncHandler(async (req, res) => {
  const data = createUserSchema.parse(req.body);
  const role = await prisma.role.findUnique({ where: { name: data.roleName } });
  if (!role) throw new ApiError(422, `Unknown role: ${data.roleName}`);

  const password = data.password || generateSecurePassword();
  if (data.password) {
    const strengthErrors = validatePasswordStrength(data.password);
    if (strengthErrors.length) throw new ApiError(422, strengthErrors.join(' '));
  }
  const passwordHash = await hashPassword(password);

  const user = await withCodeRetry(
    () =>
      prisma.user.create({
        data: { userCode: generateCode(data.roleName.slice(0, 3).toUpperCase()), email: data.email, phone: data.phone, passwordHash, roleId: role.id, mustChangePassword: true },
      }),
    'user_code'
  );

  await recordAudit({ req, action: 'user.create', entityType: 'user', entityId: user.id, after: { role: data.roleName } });
  return created(res, { userCode: user.userCode, temporaryPassword: data.password ? undefined : password });
});

const disableUser = asyncHandler(async (req, res) => {
  // Atomic: a disabled account must not leave any still-valid session —
  // both writes succeed together or neither does.
  const [user] = await prisma.$transaction([
    prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } }),
    prisma.session.updateMany({ where: { userId: req.params.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]).catch((err) => {
    if (err.code === 'P2025') throw new ApiError(404, 'User not found.');
    throw err;
  });
  await recordAudit({ req, action: 'user.disabled', entityType: 'user', entityId: req.params.id });
  return ok(res, user);
});

const activateUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: true } })
    .catch((err) => {
      if (err.code === 'P2025') throw new ApiError(404, 'User not found.');
      throw err;
    });
  await recordAudit({ req, action: 'user.activated', entityType: 'user', entityId: req.params.id });
  return ok(res, user);
});

const resetUserPassword = asyncHandler(async (req, res) => {
  const newPassword = generateSecurePassword();
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: req.params.id }, data: { passwordHash, mustChangePassword: true } }),
    prisma.session.updateMany({ where: { userId: req.params.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await recordAudit({ req, action: 'user.password_reset_by_admin', entityType: 'user', entityId: req.params.id });
  return ok(res, { temporaryPassword: newPassword });
});

const assignRole = asyncHandler(async (req, res) => {
  const data = updateRoleSchema.parse(req.body);
  const role = await prisma.role.findUnique({ where: { name: data.roleName } });
  if (!role) throw new ApiError(422, `Unknown role: ${data.roleName}`);

  const before = await prisma.user.findUnique({ where: { id: req.params.id }, include: { role: true } });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { roleId: role.id } });

  await recordAudit({ req, action: 'user.role_changed', entityType: 'user', entityId: req.params.id, before: { role: before?.role.name }, after: { role: data.roleName } });
  return ok(res, user);
});

const setPermissionOverride = asyncHandler(async (req, res) => {
  const data = permissionOverrideSchema.parse(req.body);
  const permission = await prisma.permission.findUnique({ where: { code: data.permissionCode } });
  if (!permission) throw new ApiError(422, `Unknown permission: ${data.permissionCode}`);

  const override = await prisma.userPermissionOverride.upsert({
    where: { userId_permissionId: { userId: req.params.id, permissionId: permission.id } },
    create: { userId: req.params.id, permissionId: permission.id, grantFlag: data.grant },
    update: { grantFlag: data.grant },
  });
  await recordAudit({ req, action: 'user.permission_override', entityType: 'user', entityId: req.params.id, after: data });
  return ok(res, override);
});

// ---- Roles & permissions catalogue ----
const listRoles = asyncHandler(async (req, res) => ok(res, await prisma.role.findMany({ orderBy: { name: 'asc' } })));
const listPermissions = asyncHandler(async (req, res) => ok(res, await prisma.permission.findMany({ orderBy: { module: 'asc' } })));

const setRolePermissions = asyncHandler(async (req, res) => {
  const { permissionCodes } = z.object({ permissionCodes: z.array(z.string()) }).parse(req.body);
  const role = await prisma.role.findUnique({ where: { id: Number(req.params.roleId) } });
  if (!role) throw new ApiError(404, 'Role not found.');

  const permissions = await prisma.permission.findMany({ where: { code: { in: permissionCodes } } });

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
    prisma.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })) }),
  ]);

  await recordAudit({ req, action: 'role.permissions_updated', entityType: 'role', entityId: role.id, after: { permissionCodes } });
  return ok(res, { roleId: role.id, permissionCodes });
});

// ---- Audit log viewer ----
const listAuditLogs = asyncHandler(async (req, res) => {
  const pagination = getPagination(req);
  const where = {};
  if (req.query.userId) where.userId = req.query.userId;
  if (req.query.entityType) where.entityType = req.query.entityType;
  if (req.query.action) where.action = { contains: req.query.action };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where, skip: pagination.skip, take: pagination.limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { userCode: true, role: { select: { name: true } } } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  // ids from AuditLog need string coercion for JSON serialization.
  const serialized = items.map((i) => ({ ...i, id: String(i.id) }));
  return ok(res, serialized, paginationMeta(total, pagination.page, pagination.limit));
});

module.exports = {
  listUsers, createUser, disableUser, activateUser, resetUserPassword, assignRole, setPermissionOverride,
  listRoles, listPermissions, setRolePermissions, listAuditLogs,
};
