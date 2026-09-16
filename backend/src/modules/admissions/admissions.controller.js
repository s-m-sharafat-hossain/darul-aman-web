const { z } = require('zod');
const prisma = require('../../config/db');
const { ApiError, ok, created } = require('../../utils/apiResponse');
const { asyncHandler, generateCode, withCodeRetry, getPagination, paginationMeta } = require('../../utils/helpers');
const { recordAudit } = require('../../middleware/audit');
const { hashPassword, generateSecurePassword } = require('../../utils/password');

const applicationSchema = z.object({
  applicantName: z.string().min(2).max(120),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  applyingForClassId: z.number().int().optional(),
  applyingForDepartmentId: z.number().int().optional(),
  guardianName: z.string().min(2).max(120),
  guardianPhone: z.string().min(6).max(20).regex(/^[0-9+\-\s()]+$/, 'Phone number contains invalid characters.'),
  guardianEmail: z.string().email().max(180).optional(),
  address: z.string().max(500).optional(),
  previousSchool: z.string().max(200).optional(),
  documents: z.array(z.object({ type: z.string().max(50), fileUrl: z.string().url() })).max(10).optional(),
});

const reviewSchema = z.object({
  status: z.enum(['under_review', 'correction_requested', 'approved', 'rejected']),
  reviewNote: z.string().optional(),
});

// Public endpoint — no auth required, since prospective students apply
// before they have any portal account. Still rate-limited at the app level.
const apply = asyncHandler(async (req, res) => {
  const data = applicationSchema.parse(req.body);

  // Basic duplicate-submission guard: reject a second application from the
  // same guardian phone number for the same applicant name within 24h,
  // rather than silently creating spam/duplicate records (rate limiting at
  // the route level handles high-volume abuse; this catches accidental or
  // deliberate resubmission within the limiter's own window).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await prisma.admissionApplication.findFirst({
    where: { guardianPhone: data.guardianPhone, applicantName: data.applicantName, createdAt: { gte: since } },
  });
  if (existing) {
    throw new ApiError(409, `An application for this applicant was already submitted recently (Ref: ${existing.applicationNumber}). Please contact the school office if you need to make changes.`);
  }

  const application = await withCodeRetry(
    () =>
      prisma.admissionApplication.create({
        data: {
          ...data,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
          applicationNumber: generateCode('APP'),
          documents: data.documents || undefined,
        },
      }),
    'application_number'
  );
  return created(res, { applicationNumber: application.applicationNumber, status: application.status });
});

const list = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  const pagination = getPagination(req);
  const [applications, total] = await Promise.all([
    prisma.admissionApplication.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.admissionApplication.count({ where }),
  ]);
  return ok(res, applications, paginationMeta(total, pagination.page, pagination.limit));
});

const getOne = asyncHandler(async (req, res) => {
  const application = await prisma.admissionApplication.findUnique({ where: { id: req.params.id } });
  if (!application) throw new ApiError(404, 'Application not found.');
  return ok(res, application);
});

const review = asyncHandler(async (req, res) => {
  const data = reviewSchema.parse(req.body);
  const application = await prisma.admissionApplication.update({
    where: { id: req.params.id },
    data: { ...data, reviewedBy: req.user.id, reviewedAt: new Date() },
  }).catch((err) => {
    if (err.code === 'P2025') throw new ApiError(404, 'Application not found.');
    throw err;
  });

  await recordAudit({ req, action: 'admission.reviewed', entityType: 'admission_application', entityId: req.params.id, after: data });
  return ok(res, application);
});

/**
 * Final admission step: approved application -> Student record -> optional
 * portal account, all in one transaction (spec §18's full pipeline).
 */
const finalizeAdmission = asyncHandler(async (req, res) => {
  const application = await prisma.admissionApplication.findUnique({ where: { id: req.params.id } });
  if (!application) throw new ApiError(404, 'Application not found.');
  if (application.status !== 'approved') throw new ApiError(409, 'Application must be approved before finalizing admission.');
  if (application.resultingStudentId) throw new ApiError(409, 'This application has already been finalized.');

  const { currentClassId, currentSectionId, academicYearId, createPortalAccount } = req.body;

  // studentCode is generated fresh inside the retried transaction — it's
  // used as both the student record's code and (if a portal account is
  // created) the user's login code, so both need to be regenerated together
  // on any collision retry.
  const result = await withCodeRetry(
    () =>
      prisma.$transaction(async (tx) => {
        const studentCode = generateCode('STU');
        const student = await tx.student.create({
          data: {
            studentCode,
            admissionNumber: application.applicationNumber,
            fullName: application.applicantName,
            gender: application.gender,
            dateOfBirth: application.dateOfBirth,
            presentAddress: application.address,
            departmentId: application.applyingForDepartmentId,
            currentClassId: currentClassId || application.applyingForClassId,
            currentSectionId,
            academicYearId,
            admissionDate: new Date(),
            status: 'active',
          },
        });

        await tx.admissionApplication.update({
          where: { id: application.id },
          data: { resultingStudentId: student.id },
        });

        let portalCredentials = null;
        if (createPortalAccount) {
          const studentRole = await tx.role.findUnique({ where: { name: 'student' } });
          const tempPassword = generateSecurePassword();
          const passwordHash = await hashPassword(tempPassword);
          const user = await tx.user.create({
            data: { userCode: studentCode, passwordHash, roleId: studentRole.id, mustChangePassword: true },
          });
          await tx.student.update({ where: { id: student.id }, data: { userId: user.id } });
          portalCredentials = { userCode: studentCode, temporaryPassword: tempPassword };
        }

        return { student, portalCredentials };
      }),
    ['student_code', 'user_code']
  );

  await recordAudit({ req, action: 'admission.finalized', entityType: 'student', entityId: result.student.id });
  return created(res, result);
});

module.exports = { apply, list, getOne, review, finalizeAdmission };
