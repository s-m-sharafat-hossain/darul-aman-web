const prisma = require('../../config/db');
const { hashPassword } = require('../../utils/password');
const { generateCode, withCodeRetry } = require('../../utils/helpers');
const { ApiError } = require('../../utils/apiResponse');
const { assertValidPlacement } = require('../../utils/academicHierarchy');
const { assertTeacherCanPlaceStudent } = require('../../utils/scope');

/** Fields students are NEVER allowed to edit directly (spec §5) — anything
 * touching identity, academic placement, or admission must go through
 * profile_update_requests -> admin approval instead. */
const RESTRICTED_STUDENT_FIELDS = new Set([
  'studentCode', 'registrationNumber', 'admissionNumber', 'currentClassId',
  'currentSectionId', 'departmentId', 'academicYearId', 'status', 'userId',
]);

/** Academic-placement + status fields a teacher/hifz_teacher must never be
 * able to change via the generic update endpoint, even though they now hold
 * student.edit (Phase 2 §21/§Step 3) — moving a student between department/
 * class/section, changing their academic year, or their status
 * (active/archived/etc.) stays an Admin/Principal-only operation, done via
 * the dedicated transfer/archive endpoints below. A teacher may still edit
 * ordinary profile fields (name, phone, address, blood group, etc.).
 */
const TEACHER_RESTRICTED_PLACEMENT_FIELDS = new Set([
  'currentClassId', 'currentSectionId', 'departmentId', 'academicYearId', 'status',
]);
const ADMIN_TIER_ROLES = new Set(['admin', 'super_admin', 'principal']);

async function listStudents({ filters, pagination, accessibleIds }) {
  const where = { ...filters };
  if (accessibleIds !== null) where.id = { in: accessibleIds };

  const [items, total] = await Promise.all([
    prisma.student.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { fullName: 'asc' },
      include: {
        currentClass: { select: { id: true, name: true } },
        currentSection: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    }),
    prisma.student.count({ where }),
  ]);

  // Student.academicYearId is deliberately a plain, unconstrained column —
  // schema.prisma has no @relation for it (see the note in the init
  // migration), so it can't be Prisma-`include`d like currentClass/
  // department above. Attaching it here is a single batched lookup
  // (not one query per row) rather than a schema change.
  await attachAcademicYears(items);

  return { items, total };
}

async function attachAcademicYears(students) {
  const ids = [...new Set(students.map((s) => s.academicYearId).filter((id) => id != null))];
  if (!ids.length) return;
  const years = await prisma.academicYear.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, isCurrent: true },
  });
  const byId = new Map(years.map((y) => [y.id, y]));
  for (const s of students) {
    s.academicYear = s.academicYearId != null ? byId.get(s.academicYearId) || null : null;
  }
}

async function getStudentById(id) {
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      currentClass: true,
      currentSection: true,
      department: true,
      guardians: {
        include: {
          // userId is deliberately excluded — Guardian's own portal-account
          // link has no reason to leave the server for a student-details
          // response (spec: "Do NOT expose Guardian userId").
          guardian: {
            select: { id: true, fullName: true, relationDefault: true, phone: true, email: true, occupation: true, address: true, photoUrl: true },
          },
        },
      },
      // fileUrl is deliberately excluded — it's the server-side storage
      // filename (see students.documents.controller.js), not something the
      // general "get student" response should leak, even here.
      documents: { select: { id: true, documentType: true, isVerified: true, createdAt: true, uploadedBy: true } },
      hifzEnrollment: true,
      // Historical per-year placement (spec: Student Details' Academic tab
      // history table) — Enrollment already exists for exactly this, no new
      // model/endpoint needed.
      enrollments: { include: { academicYear: true }, orderBy: { academicYearId: 'desc' } },
    },
  });
  if (!student) throw new ApiError(404, 'Student not found.');
  await attachAcademicYears([student]);
  return student;
}

/**
 * Creates a student record. Portal account (users row) creation is
 * deliberately a separate step (spec §18: "Portal Account Creation" is the
 * final admission workflow stage) — this lets admin finish onboarding a
 * student without necessarily activating login access immediately.
 *
 * `actingUser` is passed so a teacher's placement can be checked against
 * their own TeacherClassAssignment rows (spec Step 12) — admin-tier callers
 * are unrestricted. Any department/class/section combination is also
 * cross-validated as a real, connected hierarchy chain (spec §3/Step 4)
 * regardless of who is creating the student.
 */
async function createStudent(data, actingUser) {
  const { guardians, ...studentFields } = data;

  await assertValidPlacement({
    departmentId: studentFields.departmentId,
    classId: studentFields.currentClassId,
    sectionId: studentFields.currentSectionId,
  });
  if (actingUser) {
    await assertTeacherCanPlaceStudent(actingUser, {
      classId: studentFields.currentClassId,
      sectionId: studentFields.currentSectionId,
    });
  }

  return withCodeRetry(
    () =>
      prisma.$transaction(async (tx) => {
        const student = await tx.student.create({
          data: { ...studentFields, studentCode: generateCode('STU'), status: 'active' },
        });

        if (guardians?.length) {
          const missingGuardianId = guardians.find((g) => !g.guardianId);
          if (missingGuardianId) {
            // Guardian.userId is required + unique in the schema, so a
            // guardian can never be created without one — and portal
            // accounts (which provision that userId) are deliberately only
            // created explicitly via the guardians module, not as a side
            // effect of student creation. An entry with no guardianId can
            // therefore never be linked; fail clearly instead of silently
            // doing nothing, which is what this used to do.
            throw new ApiError(
              422,
              'Each guardian entry must reference an existing guardian (guardianId). Create the guardian via the Guardians module first, then link them here.'
            );
          }
          for (const g of guardians) {
            await tx.studentGuardian.create({
              data: {
                studentId: student.id,
                guardianId: g.guardianId,
                relation: g.relation,
                isPrimary: Boolean(g.isPrimary),
              },
            });
          }
        }

        return student;
      }),
    'student_code'
  );
}

/**
 * `actingRole` gates two different things here (spec Step 3/§21):
 *  - a student can never touch RESTRICTED_STUDENT_FIELDS at all (unchanged
 *    from before — identity/admission/placement fields need admin approval
 *    via profile_update_requests)
 *  - a teacher/hifz_teacher additionally can never touch
 *    TEACHER_RESTRICTED_PLACEMENT_FIELDS (department/class/section/
 *    academic year/status) even though they now hold student.edit — moving
 *    a student or changing their status is Admin/Principal-only, done via
 *    the dedicated transfer/archive endpoints. Ordinary profile fields
 *    (name, phone, address, blood group, etc.) remain editable by a teacher
 *    for students within their own scope (enforced by
 *    assertCanAccessStudent before this is ever called).
 * Any placement fields an admin-tier caller DOES change here are still
 * cross-validated as a real department/class/section chain.
 */
async function updateStudent(id, rawData, actingRole) {
  const { guardians, ...data } = rawData;
  const disallowed = Object.keys(data).filter((k) => RESTRICTED_STUDENT_FIELDS.has(k));
  if (disallowed.length && actingRole === 'student') {
    throw new ApiError(403, `Students cannot directly edit: ${disallowed.join(', ')}. Submit a profile update request instead.`);
  }

  if (!ADMIN_TIER_ROLES.has(actingRole)) {
    const teacherDisallowed = Object.keys(data).filter((k) => TEACHER_RESTRICTED_PLACEMENT_FIELDS.has(k));
    if (teacherDisallowed.length) {
      throw new ApiError(
        403,
        `You cannot change: ${teacherDisallowed.join(', ')}. Academic placement and status changes are Admin-only — use the transfer/archive actions.`
      );
    }
  } else {
    const touchesPlacement = ['departmentId', 'currentClassId', 'currentSectionId'].some((k) => k in data);
    if (touchesPlacement) {
      const existing = await prisma.student.findUnique({
        where: { id },
        select: { departmentId: true, currentClassId: true, currentSectionId: true },
      });
      if (!existing) throw new ApiError(404, 'Student not found.');
      await assertValidPlacement({
        departmentId: 'departmentId' in data ? data.departmentId : existing.departmentId,
        classId: 'currentClassId' in data ? data.currentClassId : existing.currentClassId,
        sectionId: 'currentSectionId' in data ? data.currentSectionId : existing.currentSectionId,
      });
    }
  }

  const student = await prisma.student.update({ where: { id }, data }).catch((error) => {
    if (error.code === 'P2025') {
      throw new ApiError(404, 'Student not found.');
    }
    throw error;
  });
  return student;
}

/** Creates the login account for an already-onboarded student (spec §18 final step). */
async function createPortalAccount(studentId, { password }) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new ApiError(404, 'Student not found.');
  if (student.userId) throw new ApiError(409, 'Portal account already exists for this student.');

  const studentRole = await prisma.role.findUnique({ where: { name: 'student' } });
  const passwordHash = await hashPassword(password);
  const userCode = student.studentCode;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        userCode,
        passwordHash,
        roleId: studentRole.id,
        mustChangePassword: true,
      },
    });
    await tx.student.update({ where: { id: studentId }, data: { userId: user.id } });
    return user;
  });
}

async function requestProfileUpdate(studentId, requestedBy, { fieldName, newValue }) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new ApiError(404, 'Student not found.');

  return prisma.profileUpdateRequest.create({
    data: {
      studentId,
      requestedBy,
      fieldName,
      oldValue: String(student[fieldName] ?? ''),
      newValue,
      status: 'pending',
    },
  });
}

async function reviewProfileUpdate(requestId, reviewerId, { status, reviewNote }) {
  const request = await prisma.profileUpdateRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new ApiError(404, 'Request not found.');
  if (request.status !== 'pending') throw new ApiError(409, 'This request has already been reviewed.');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.profileUpdateRequest.update({
      where: { id: requestId },
      data: { status, reviewNote, reviewedBy: reviewerId, reviewedAt: new Date() },
    });

    if (status === 'approved') {
      await tx.student.update({
        where: { id: request.studentId },
        data: { [request.fieldName]: request.newValue },
      });
    }
    return updated;
  });
}

async function promoteStudents({ studentIds, toClassId, toSectionId, academicYearId }) {
  await assertValidPlacement({ classId: toClassId, sectionId: toSectionId });
  return prisma.$transaction(async (tx) => {
    const results = [];
    for (const studentId of studentIds) {
      await tx.student.update({
        where: { id: studentId },
        data: { currentClassId: toClassId, currentSectionId: toSectionId, academicYearId },
      });
      const enrollment = await tx.enrollment.upsert({
        where: { studentId_academicYearId: { studentId, academicYearId } },
        create: { studentId, academicYearId, classId: toClassId, sectionId: toSectionId, status: 'ongoing' },
        update: { classId: toClassId, sectionId: toSectionId, status: 'ongoing' },
      });
      results.push(enrollment);
    }
    return results;
  });
}

/**
 * Admin-only: moves a student to a new department/class/section/academic
 * year (spec Step 5/§22). Cross-validates the full hierarchy first, then
 * only updates the student's *current* placement — old attendance, exam
 * results, fees, Hifz records, and assignment submissions all reference the
 * student by id and are never touched. The current year's Enrollment row is
 * upserted (mirroring promoteStudents) so history for *other* academic
 * years is preserved; only this year's enrollment reflects the new
 * placement. Returns the old and new placement so the caller can audit-log
 * both.
 */
async function transferStudent(id, { departmentId, classId, sectionId, academicYearId }) {
  const existing = await prisma.student.findUnique({
    where: { id },
    select: { departmentId: true, currentClassId: true, currentSectionId: true, academicYearId: true },
  });
  if (!existing) throw new ApiError(404, 'Student not found.');

  await assertValidPlacement({ departmentId, classId, sectionId });

  const updated = await prisma.$transaction(async (tx) => {
    const student = await tx.student.update({
      where: { id },
      data: {
        departmentId,
        currentClassId: classId,
        currentSectionId: sectionId,
        academicYearId,
      },
    });
    if (academicYearId) {
      await tx.enrollment.upsert({
        where: { studentId_academicYearId: { studentId: id, academicYearId } },
        create: { studentId: id, academicYearId, classId, sectionId, status: 'ongoing' },
        update: { classId, sectionId, status: 'ongoing' },
      });
    }
    return student;
  });

  return {
    student: updated,
    oldPlacement: existing,
    newPlacement: { departmentId, classId, sectionId, academicYearId },
  };
}

/**
 * Admin-only: soft-archives a student (spec Step 6/§23) — never a hard
 * delete. All historical attendance/exam/fee/Hifz/assignment rows are
 * untouched since they reference the student by id, not by status.
 */
async function archiveStudent(id) {
  const student = await prisma.student.update({
    where: { id },
    data: { status: 'archived' },
  }).catch(() => {
    throw new ApiError(404, 'Student not found.');
  });
  return student;
}

module.exports = {
  listStudents,
  getStudentById,
  createStudent,
  updateStudent,
  createPortalAccount,
  requestProfileUpdate,
  reviewProfileUpdate,
  promoteStudents,
  transferStudent,
  archiveStudent,
  RESTRICTED_STUDENT_FIELDS,
};
