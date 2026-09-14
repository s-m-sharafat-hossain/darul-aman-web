const prisma = require('../../config/db');
const service = require('./assignments.service');
const { createAssignmentSchema, updateAssignmentSchema } = require('./assignments.schema');
const { ok, created, noContent, ApiError } = require('../../utils/apiResponse');
const { asyncHandler } = require('../../utils/helpers');
const { assertCanAccessStudent } = require('../../utils/scope');
const { recordAudit } = require('../../middleware/audit');

const PRIVILEGED_ROLES = ['admin', 'super_admin', 'principal', 'hifz_coordinator'];

async function resolveTeacherId(userId) {
  const teacher = await prisma.teacher.findFirst({ where: { staff: { userId } } });
  return teacher ? teacher.id : null;
}

const create = asyncHandler(async (req, res) => {
  const data = createAssignmentSchema.parse(req.body);
  const teacherId = await resolveTeacherId(req.user.id);
  if (!teacherId) throw new ApiError(403, 'Only teaching staff can create assignments.');

  const assignment = await service.createAssignment(data, teacherId);
  await recordAudit({ req, action: 'assignment.created', entityType: 'assignment', entityId: assignment.id });
  return created(res, assignment);
});

const listMine = asyncHandler(async (req, res) => {
  const teacherId = await resolveTeacherId(req.user.id);
  if (!teacherId) return ok(res, []);
  const assignments = await service.listMine(teacherId);
  return ok(res, assignments);
});

const update = asyncHandler(async (req, res) => {
  const data = updateAssignmentSchema.parse(req.body);
  const teacherId = await resolveTeacherId(req.user.id);
  const isPrivileged = PRIVILEGED_ROLES.includes(req.user.role);
  if (!teacherId && !isPrivileged) throw new ApiError(403, 'Only teaching staff can edit assignments.');

  const updated = await service.updateAssignment(req.params.id, data, teacherId, isPrivileged);
  await recordAudit({ req, action: 'assignment.updated', entityType: 'assignment', entityId: req.params.id, after: data });
  return ok(res, updated);
});

const remove = asyncHandler(async (req, res) => {
  const teacherId = await resolveTeacherId(req.user.id);
  const isPrivileged = PRIVILEGED_ROLES.includes(req.user.role);
  if (!teacherId && !isPrivileged) throw new ApiError(403, 'Only teaching staff can delete assignments.');

  await service.deleteAssignment(req.params.id, teacherId, isPrivileged);
  await recordAudit({ req, action: 'assignment.deleted', entityType: 'assignment', entityId: req.params.id });
  return noContent(res);
});

/** A student sees assignments for their own current class/section only. */
const listForStudent = asyncHandler(async (req, res) => {
  await assertCanAccessStudent(req.user, req.params.studentId);
  const assignments = await service.listForStudent(req.params.studentId);
  return ok(res, assignments);
});

module.exports = { create, listMine, update, remove, listForStudent };
