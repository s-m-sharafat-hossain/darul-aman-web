const service = require('./students.service');
const {
  createStudentSchema,
  updateStudentSchema,
  profileUpdateRequestSchema,
  reviewProfileUpdateSchema,
  promoteStudentSchema,
  transferStudentSchema,
} = require('./students.schema');
const { ok, created, ApiError } = require('../../utils/apiResponse');
const { asyncHandler, getPagination, paginationMeta } = require('../../utils/helpers');
const { getAccessibleStudentIds, assertCanAccessStudent } = require('../../utils/scope');
const { recordAudit } = require('../../middleware/audit');
const { generateSecurePassword, validatePasswordStrength } = require('../../utils/password');

const list = asyncHandler(async (req, res) => {
  const pagination = getPagination(req);
  const accessibleIds = await getAccessibleStudentIds(req.user);

  const filters = {};
  if (req.query.classId) filters.currentClassId = Number(req.query.classId);
  if (req.query.sectionId) filters.currentSectionId = Number(req.query.sectionId);
  if (req.query.departmentId) filters.departmentId = Number(req.query.departmentId);
  if (req.query.academicYearId) {
    const academicYearId = Number(req.query.academicYearId);
    if (!Number.isInteger(academicYearId)) {
      throw new ApiError(422, 'academicYearId must be a valid integer.');
    }
    filters.academicYearId = academicYearId;
  }
  if (req.query.status) filters.status = req.query.status;
  if (req.query.search) {
    filters.OR = [
      { fullName: { contains: req.query.search, mode: 'insensitive' } },
      { studentCode: { contains: req.query.search, mode: 'insensitive' } },
      { rollNumber: { contains: req.query.search, mode: 'insensitive' } },
    ];
  }

  const { items, total } = await service.listStudents({ filters, pagination, accessibleIds });
  return ok(res, items, paginationMeta(total, pagination.page, pagination.limit));
});

const getOne = asyncHandler(async (req, res) => {
  await assertCanAccessStudent(req.user, req.params.id);
  const student = await service.getStudentById(req.params.id);
  return ok(res, student);
});

const create = asyncHandler(async (req, res) => {
  const data = createStudentSchema.parse(req.body);
  const student = await service.createStudent(data, req.user);
  await recordAudit({ req, action: 'student.create', entityType: 'student', entityId: student.id, after: student });
  return created(res, student);
});

const update = asyncHandler(async (req, res) => {
  await assertCanAccessStudent(req.user, req.params.id);
  const before = await service.getStudentById(req.params.id);
  const data = updateStudentSchema.parse(req.body);
  const updated = await service.updateStudent(req.params.id, data, req.user.role);
  await recordAudit({ req, action: 'student.update', entityType: 'student', entityId: req.params.id, before, after: updated });
  return ok(res, updated);
});

const createPortalAccount = asyncHandler(async (req, res) => {
  await assertCanAccessStudent(req.user, req.params.id);
  if (req.body.password) {
    const strengthErrors = validatePasswordStrength(req.body.password);
    if (strengthErrors.length) throw new ApiError(422, strengthErrors.join(' '));
  }
  const password = req.body.password || generateSecurePassword();
  const user = await service.createPortalAccount(req.params.id, { password });
  await recordAudit({ req, action: 'student.portal_account_created', entityType: 'student', entityId: req.params.id });
  // Return the generated password once, in-band, so admin can hand it to the
  // student securely (e.g. printed) — never store or log it in plaintext elsewhere.
  return created(res, { userCode: user.userCode, temporaryPassword: password });
});

const requestProfileUpdate = asyncHandler(async (req, res) => {
  await assertCanAccessStudent(req.user, req.params.id);
  const data = profileUpdateRequestSchema.parse(req.body);
  const request = await service.requestProfileUpdate(req.params.id, req.user.id, data);
  return created(res, request);
});

const reviewProfileUpdate = asyncHandler(async (req, res) => {
  const data = reviewProfileUpdateSchema.parse(req.body);
  const result = await service.reviewProfileUpdate(req.params.requestId, req.user.id, data);
  await recordAudit({ req, action: 'student.profile_update_reviewed', entityType: 'profile_update_request', entityId: req.params.requestId, after: result });
  return ok(res, result);
});

const promote = asyncHandler(async (req, res) => {
  const data = promoteStudentSchema.parse(req.body);
  const result = await service.promoteStudents(data);
  await recordAudit({ req, action: 'student.promote', entityType: 'student', entityId: data.studentIds.join(','), after: { toClassId: data.toClassId } });
  return ok(res, result);
});

// Admin/Principal-only (route-gated by student.transfer, see students.routes.js).
// Moves a student's current academic placement; historical
// attendance/exam/fee/Hifz/assignment records are never rewritten.
const transfer = asyncHandler(async (req, res) => {
  const data = transferStudentSchema.parse(req.body);
  const { student, oldPlacement, newPlacement } = await service.transferStudent(req.params.id, data);
  await recordAudit({
    req,
    action: 'student.transfer',
    entityType: 'student',
    entityId: req.params.id,
    before: oldPlacement,
    after: newPlacement,
  });
  return ok(res, student);
});

// Admin/Principal-only (route-gated by student.archive). Soft-archive only —
// never a hard delete; all historical records stay intact.
const archive = asyncHandler(async (req, res) => {
  const before = await service.getStudentById(req.params.id);
  const student = await service.archiveStudent(req.params.id);
  await recordAudit({
    req,
    action: 'student.archive',
    entityType: 'student',
    entityId: req.params.id,
    before: { status: before.status },
    after: { status: student.status },
  });
  return ok(res, student);
});

module.exports = {
  list, getOne, create, update, createPortalAccount,
  requestProfileUpdate, reviewProfileUpdate, promote, transfer, archive,
};
