const { z } = require('zod');
const prisma = require('../../config/db');
const { hashPassword, generateSecurePassword } = require('../../utils/password');
const { ApiError, ok, created } = require('../../utils/apiResponse');
const { asyncHandler, generateCode, withCodeRetry } = require('../../utils/helpers');
const { recordAudit } = require('../../middleware/audit');

const createGuardianSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(6),
  email: z.string().email().optional(),
  occupation: z.string().optional(),
  address: z.string().optional(),
  relationDefault: z.string().optional(),
  createPortalAccount: z.boolean().default(true),
  linkStudents: z.array(z.object({ studentId: z.string().uuid(), relation: z.string(), isPrimary: z.boolean().optional() })).optional(),
});

const create = asyncHandler(async (req, res) => {
  const data = createGuardianSchema.parse(req.body);

  // userCode is generated fresh inside the retried transaction (not before
  // it) so a collision retry actually gets a new value to try, and the
  // whole transaction re-runs atomically rather than leaving a partial
  // guardian/user/link behind.
  const result = await withCodeRetry(
    () =>
      prisma.$transaction(async (tx) => {
        const userCode = generateCode('GRD');
        let userId = null;
        let portalCredentials = null;

        if (data.createPortalAccount) {
          const role = await tx.role.findUnique({ where: { name: 'guardian' } });
          const tempPassword = generateSecurePassword();
          const passwordHash = await hashPassword(tempPassword);
          const user = await tx.user.create({
            data: { userCode, email: data.email, phone: data.phone, passwordHash, roleId: role.id, mustChangePassword: true },
          });
          userId = user.id;
          portalCredentials = { userCode, temporaryPassword: tempPassword };
        }

        const guardian = await tx.guardian.create({
          data: {
            userId,
            fullName: data.fullName,
            phone: data.phone,
            email: data.email,
            occupation: data.occupation,
            address: data.address,
            relationDefault: data.relationDefault,
          },
        });

        if (data.linkStudents?.length) {
          for (const link of data.linkStudents) {
            await tx.studentGuardian.create({
              data: { studentId: link.studentId, guardianId: guardian.id, relation: link.relation, isPrimary: Boolean(link.isPrimary) },
            });
          }
        }

        return { guardian, portalCredentials };
      }),
    'user_code'
  );

  await recordAudit({ req, action: 'guardian.create', entityType: 'guardian', entityId: result.guardian.id });
  return created(res, result);
});

/** A guardian's linked children — used to populate the child-switcher in the Guardian Portal. */
const myChildren = asyncHandler(async (req, res) => {
  const guardian = await prisma.guardian.findUnique({
    where: { userId: req.user.id },
    include: {
      students: {
        include: {
          student: {
            select: {
              id: true, fullName: true, studentCode: true, photoUrl: true, rollNumber: true,
              currentClass: { select: { name: true } }, currentSection: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!guardian) throw new ApiError(404, 'Guardian profile not found for this account.');
  return ok(res, guardian.students.map((sg) => ({ ...sg.student, relation: sg.relation, isPrimary: sg.isPrimary })));
});

const linkStudent = asyncHandler(async (req, res) => {
  const { studentId, relation, isPrimary } = z
    .object({ studentId: z.string().uuid(), relation: z.string(), isPrimary: z.boolean().optional() })
    .parse(req.body);

  const [guardian, student] = await Promise.all([
    prisma.guardian.findUnique({ where: { id: req.params.id }, select: { id: true } }),
    prisma.student.findUnique({ where: { id: studentId }, select: { id: true } }),
  ]);
  if (!guardian) throw new ApiError(404, 'Guardian not found.');
  if (!student) throw new ApiError(422, 'Student not found.');

  const existing = await prisma.studentGuardian.findUnique({
    where: { studentId_guardianId: { studentId, guardianId: req.params.id } },
  });
  if (existing) throw new ApiError(409, 'This guardian is already linked to this student.');

  const link = await prisma.studentGuardian.create({
    data: { studentId, guardianId: req.params.id, relation, isPrimary: Boolean(isPrimary) },
  });
  await recordAudit({ req, action: 'guardian.linked_student', entityType: 'guardian', entityId: req.params.id, after: { studentId } });
  return created(res, link);
});

module.exports = { create, myChildren, linkStudent };
