const service = require('./hifz.service');
const { enrollSchema, dailyEvaluationSchema, paraCompletionSchema, hifzExamSchema, bulkEvaluationSchema } = require('./hifz.schema');
const { ok, created } = require('../../utils/apiResponse');
const { asyncHandler } = require('../../utils/helpers');
const { assertCanAccessStudent, assertCanManageHifzEnrollment } = require('../../utils/scope');
const { recordAudit } = require('../../middleware/audit');
const prisma = require('../../config/db');

const HIFZ_UNRESTRICTED_ROLES = ['admin', 'super_admin', 'principal', 'hifz_coordinator'];

const enroll = asyncHandler(async (req, res) => {
  const data = enrollSchema.parse(req.body);

  // hifz.create is also granted to the hifz_teacher role, but a teacher must
  // not be able to enroll a student under someone else's name by supplying
  // an arbitrary assignedTeacherId in the body — never trust that field from
  // a non-privileged caller. Only coordinators/admins may assign any teacher.
  if (!HIFZ_UNRESTRICTED_ROLES.includes(req.user.role)) {
    const teacher = await prisma.teacher.findFirst({ where: { staff: { userId: req.user.id } } });
    if (!teacher) return res.status(403).json({ success: false, error: { message: 'Only Hifz teachers can enroll students.' } });
    if (data.assignedTeacherId && data.assignedTeacherId !== teacher.id) {
      return res.status(403).json({ success: false, error: { message: 'You can only enroll students under your own name.' } });
    }
    data.assignedTeacherId = teacher.id;
  }

  const enrollment = await service.enrollStudent(data);
  await recordAudit({ req, action: 'hifz.enroll', entityType: 'hifz_enrollment', entityId: enrollment.id });
  return created(res, enrollment);
});

const overview = asyncHandler(async (req, res) => {
  await assertCanAccessStudent(req.user, req.params.studentId);
  const data = await service.getOverview(req.params.studentId);
  return ok(res, data);
});

const recordEvaluation = asyncHandler(async (req, res) => {
  const data = dailyEvaluationSchema.parse(req.body);
  // Never trust the client-supplied enrollment id — confirm this caller is
  // actually the assigned teacher (or a coordinator/admin) before writing.
  await assertCanManageHifzEnrollment(req.user, data.hifzEnrollmentId);

  const teacher = await prisma.teacher.findFirst({ where: { staff: { userId: req.user.id } } });
  if (!teacher) return res.status(403).json({ success: false, error: { message: 'Only Hifz teachers can record evaluations.' } });

  const evaluation = await service.recordDailyEvaluation(data, teacher.id);
  await recordAudit({ req, action: 'hifz.daily_evaluation', entityType: 'hifz_enrollment', entityId: data.hifzEnrollmentId });
  return created(res, evaluation);
});

const markParaCompleted = asyncHandler(async (req, res) => {
  const data = paraCompletionSchema.parse(req.body);
  await assertCanManageHifzEnrollment(req.user, req.params.enrollmentId);
  const result = await service.markParaCompleted(req.params.enrollmentId, data, req.user.id);
  await recordAudit({ req, action: 'hifz.para_completed', entityType: 'hifz_enrollment', entityId: req.params.enrollmentId, after: { paraId: data.paraId } });
  return ok(res, result);
});

const recordExam = asyncHandler(async (req, res) => {
  const data = hifzExamSchema.parse(req.body);
  await assertCanManageHifzEnrollment(req.user, req.params.enrollmentId);
  const exam = await service.recordExam(req.params.enrollmentId, data, req.user.id);
  return created(res, exam);
});

const issueCertificate = asyncHandler(async (req, res) => {
  // Certificate issuance requires hifz.approve, which coordinators/admins
  // hold — but still confirm the enrollment exists and, for a teacher-role
  // holder of that permission, that it's theirs.
  await assertCanManageHifzEnrollment(req.user, req.params.enrollmentId);
  const cert = await service.issueCertificate(req.params.enrollmentId, req.user.id);
  await recordAudit({ req, action: 'hifz.certificate_issued', entityType: 'hifz_enrollment', entityId: req.params.enrollmentId });
  return created(res, cert);
});

const recordBulkEvaluations = asyncHandler(async (req, res) => {
  const data = bulkEvaluationSchema.parse(req.body);

  const teacher = await prisma.teacher.findFirst({ where: { staff: { userId: req.user.id } } });
  if (!teacher && req.user.role !== 'hifz_coordinator' && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { message: 'Only Hifz teachers can record evaluations.' } });
  }
  const isPrivileged = ['hifz_coordinator', 'admin', 'super_admin', 'principal'].includes(req.user.role);

  const result = await service.recordBulkEvaluations(data, teacher?.id, isPrivileged);
  await recordAudit({
    req,
    action: 'hifz.bulk_evaluation',
    entityType: 'hifz_enrollment',
    entityId: 'bulk',
    after: { evaluationDate: data.evaluationDate, saved: result.saved, skipped: result.skipped.length },
  });
  return ok(res, result);
});

const teacherRoster = asyncHandler(async (req, res) => {
  const teacher = await prisma.teacher.findFirst({ where: { staff: { userId: req.user.id } } });
  if (!teacher) return ok(res, []);
  const roster = await service.getTeacherRoster(teacher.id);
  return ok(res, roster);
});

const analytics = asyncHandler(async (req, res) => {
  // hifz.view is also granted to the plain teacher/hifz_teacher roles, but
  // school-wide numbers (every enrollment, every teacher's name) must stay
  // restricted to admin/principal/coordinator-tier roles — same unrestricted
  // vs. own-roster-only split used for enrollment/certificate actions above.
  if (HIFZ_UNRESTRICTED_ROLES.includes(req.user.role)) {
    const data = await service.getAnalytics();
    return ok(res, data);
  }

  const teacher = await prisma.teacher.findFirst({ where: { staff: { userId: req.user.id } } });
  if (!teacher) return ok(res, { totalStudents: 0, completed: 0, ongoing: 0, avgCompletion: 0, byTeacher: {} });

  const data = await service.getAnalytics(teacher.id);
  return ok(res, data);
});

module.exports = { enroll, overview, recordEvaluation, recordBulkEvaluations, markParaCompleted, recordExam, issueCertificate, teacherRoster, analytics };
