const service = require('./attendance.service');
const { bulkMarkAttendanceSchema, editAttendanceSchema } = require('./attendance.schema');
const { ok, ApiError } = require('../../utils/apiResponse');
const { asyncHandler } = require('../../utils/helpers');
const { assertCanAccessStudent, assertCanManageClassAttendance } = require('../../utils/scope');
const { recordAudit } = require('../../middleware/audit');

const bulkMark = asyncHandler(async (req, res) => {
  const data = bulkMarkAttendanceSchema.parse(req.body);
  // Never trust classId/sectionId alone as proof the caller may mark this
  // class — and never trust the studentIds in `entries` without checking
  // they actually belong to that class/section (enforced in the service).
  await assertCanManageClassAttendance(req.user, data);
  const result = await service.bulkMark(data, req.user.id);
  await recordAudit({ req, action: 'attendance.bulk_mark', entityType: 'class', entityId: data.classId, after: { count: result.length, date: data.attendanceDate } });
  return ok(res, result);
});

const editOne = asyncHandler(async (req, res) => {
  const data = editAttendanceSchema.parse(req.body);
  const { updated, before, reason } = await service.editAttendance(req.params.id, data, req.user.id);

  // Dedicated attendance_change_log write happens via audit log with reason
  // captured explicitly, per spec §14's audit-trail requirement.
  await recordAudit({
    req,
    action: 'attendance.edit',
    entityType: 'student_attendance',
    entityId: req.params.id,
    before: { status: before.status },
    after: { status: updated.status, reason },
  });
  return ok(res, updated);
});

const studentAttendance = asyncHandler(async (req, res) => {
  await assertCanAccessStudent(req.user, req.params.studentId);
  const result = await service.getStudentAttendance(req.params.studentId, req.query);
  return ok(res, result);
});

const classAttendance = asyncHandler(async (req, res) => {
  const { classId, sectionId, date } = req.query;
  if (!classId || !date) throw new ApiError(400, 'classId and date are required.');
  await assertCanManageClassAttendance(req.user, {
    classId: Number(classId),
    sectionId: sectionId ? Number(sectionId) : undefined,
    academicYearId: req.query.academicYearId ? Number(req.query.academicYearId) : undefined,
  });
  const result = await service.getClassAttendanceForDate(Number(classId), sectionId ? Number(sectionId) : undefined, date);
  return ok(res, result);
});

module.exports = { bulkMark, editOne, studentAttendance, classAttendance };
