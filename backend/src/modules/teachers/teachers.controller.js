const { z } = require('zod');
const prisma = require('../../config/db');
const { hashPassword, generateSecurePassword } = require('../../utils/password');
const { ApiError, ok, created } = require('../../utils/apiResponse');
const { asyncHandler, generateCode, getPagination, paginationMeta, withCodeRetry } = require('../../utils/helpers');
const { recordAudit } = require('../../middleware/audit');

const createTeacherSchema = z.object({
  fullName: z.string().min(2),
  gender: z.enum(['male', 'female']).optional(),
  dateOfBirth: z.string().optional(),
  designationId: z.number().int().optional(),
  departmentId: z.number().int().optional(),
  address: z.string().optional(),
  joiningDate: z.string().optional(),
  teacherType: z.enum(['general', 'hifz', 'both']).default('general'),
  specialization: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  createPortalAccount: z.boolean().default(true),
});

const assignClassSchema = z.object({
  classId: z.number().int(),
  sectionId: z.number().int().optional(),
  subjectId: z.number().int().optional(),
  academicYearId: z.number().int(),
  isClassTeacher: z.boolean().optional(),
});

const list = asyncHandler(async (req, res) => {
  const pagination = getPagination(req);
  const where = {};
  if (req.query.teacherType) where.teacherType = req.query.teacherType;

  const [items, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      include: { staff: { include: { designation: true, department: true } } },
    }),
    prisma.teacher.count({ where }),
  ]);
  return ok(res, items, paginationMeta(total, pagination.page, pagination.limit));
});

const getOne = asyncHandler(async (req, res) => {
  const teacher = await prisma.teacher.findUnique({
    where: { id: req.params.id },
    include: {
      staff: { include: { designation: true, department: true, user: { select: { email: true, phone: true, userCode: true } } } },
    },
  });
  if (!teacher) throw new ApiError(404, 'Teacher not found.');
  return ok(res, teacher);
});

/** Creates staff + teacher (+ optional portal user) in one transaction. */
const create = asyncHandler(async (req, res) => {
  const data = createTeacherSchema.parse(req.body);

  // staffCode is generated fresh inside the retried transaction (it's used
  // as both the user's login code and the staff record's code — same value
  // for both, regenerated together on any collision retry).
  const result = await withCodeRetry(
    () =>
      prisma.$transaction(async (tx) => {
        const staffCode = generateCode('STF');
        let userId = null;
        let portalCredentials = null;

        if (data.createPortalAccount) {
          const roleName = data.teacherType === 'hifz' ? 'hifz_teacher' : 'teacher';
          const role = await tx.role.findUnique({ where: { name: roleName } });
          const tempPassword = generateSecurePassword();
          const passwordHash = await hashPassword(tempPassword);
          const user = await tx.user.create({
            data: {
              userCode: staffCode,
              email: data.email,
              phone: data.phone,
              passwordHash,
              roleId: role.id,
              mustChangePassword: true,
            },
          });
          userId = user.id;
          portalCredentials = { userCode: staffCode, temporaryPassword: tempPassword };
        }

        const staff = await tx.staff.create({
          data: {
            userId,
            staffCode,
            fullName: data.fullName,
            gender: data.gender,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
            designationId: data.designationId,
            departmentId: data.departmentId,
            address: data.address,
            joiningDate: data.joiningDate ? new Date(data.joiningDate) : undefined,
          },
        });

        const teacher = await tx.teacher.create({
          data: { staffId: staff.id, teacherType: data.teacherType, specialization: data.specialization },
        });

        return { teacher, staff, portalCredentials };
      }),
    ['user_code', 'staff_code']
  );

  await recordAudit({ req, action: 'teacher.create', entityType: 'teacher', entityId: result.teacher.id });
  return created(res, result);
});

const assignClass = asyncHandler(async (req, res) => {
  const data = assignClassSchema.parse(req.body);
  const assignment = await prisma.teacherClassAssignment.create({
    data: { teacherId: req.params.id, ...data },
  });
  await recordAudit({ req, action: 'teacher.class_assigned', entityType: 'teacher', entityId: req.params.id, after: data });
  return created(res, assignment);
});

const myAssignments = asyncHandler(async (req, res) => {
  const teacher = await prisma.teacher.findFirst({ where: { staff: { userId: req.user.id } } });
  if (!teacher) return ok(res, []);
  const assignments = await prisma.teacherClassAssignment.findMany({
    where: { teacherId: teacher.id },
    include: { }, // class/section/subject relations resolved by frontend via separate lookups, or extend include here
  });
  return ok(res, assignments);
});

module.exports = { list, getOne, create, assignClass, myAssignments };
