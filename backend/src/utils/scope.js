const prisma = require('../config/db');
const { ApiError } = require('./apiResponse');

/**
 * Resolves which student IDs the current user is allowed to touch. This is
 * the enforcement point for spec §38 ("never access another role's data by
 * changing a URL") — every student-scoped route calls this instead of
 * trusting a studentId in the URL/body at face value.
 *
 * - admin/super_admin/principal/hifz_coordinator/accountant/receptionist: unrestricted (null = "no filter")
 * - teacher: students in classes/sections they're assigned to teach
 * - hifz_teacher: their assigned Hifz students
 * - guardian: their linked children
 * - student: only themselves
 */
async function getAccessibleStudentIds(user) {
  const staffLikeUnrestricted = ['admin', 'super_admin', 'principal', 'accountant', 'receptionist', 'hifz_coordinator'];
  if (staffLikeUnrestricted.includes(user.role)) return null; // null = unrestricted

  if (user.role === 'teacher') {
    const teacher = await prisma.teacher.findFirst({ where: { staff: { userId: user.id } } });
    if (!teacher) return [];
    const assignments = await prisma.teacherClassAssignment?.findMany?.({
      where: { teacherId: teacher.id },
    }).catch(() => []);
    // Fallback: if no fine-grained assignment table populated, scope by
    // class/section the teacher is assigned to via routines instead.
    const classIds = [...new Set((assignments || []).map((a) => a.classId))];
    if (!classIds.length) return [];
    const students = await prisma.student.findMany({
      where: { currentClassId: { in: classIds } },
      select: { id: true },
    });
    return students.map((s) => s.id);
  }

  if (user.role === 'hifz_teacher') {
    const teacher = await prisma.teacher.findFirst({ where: { staff: { userId: user.id } } });
    if (!teacher) return [];
    const students = await prisma.student.findMany({
      where: { hifzTeacherId: teacher.id },
      select: { id: true },
    });
    return students.map((s) => s.id);
  }

  if (user.role === 'guardian') {
    const guardian = await prisma.guardian.findUnique({
      where: { userId: user.id },
      include: { students: { select: { studentId: true } } },
    });
    if (!guardian) return [];
    return guardian.students.map((sg) => sg.studentId);
  }

  if (user.role === 'student') {
    const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true } });
    return student ? [student.id] : [];
  }

  return []; // unknown role: deny by default
}

/** Throws 403 unless studentId is within the caller's accessible set. */
async function assertCanAccessStudent(user, studentId) {
  const accessible = await getAccessibleStudentIds(user);
  if (accessible === null) return; // unrestricted role
  if (!accessible.includes(studentId)) {
    throw new ApiError(403, 'You do not have access to this student\'s records.');
  }
}

/**
 * Throws 403/404 unless the caller may manage (evaluate/mark progress/
 * exam/certificate) the given Hifz enrollment. Coordinators/admin-tier
 * roles may manage any enrollment; a Hifz teacher may only manage
 * enrollments assigned to their own Teacher record. Never trust an
 * enrollmentId from the client as proof of ownership.
 */
async function assertCanManageHifzEnrollment(user, enrollmentId) {
  const unrestricted = ['admin', 'super_admin', 'principal', 'hifz_coordinator'];
  if (unrestricted.includes(user.role)) {
    const exists = await prisma.hifzEnrollment.findUnique({ where: { id: enrollmentId }, select: { id: true } });
    if (!exists) throw new ApiError(404, 'Hifz enrollment not found.');
    return exists;
  }

  const enrollment = await prisma.hifzEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, assignedTeacherId: true },
  });
  if (!enrollment) throw new ApiError(404, 'Hifz enrollment not found.');

  const teacher = await prisma.teacher.findFirst({ where: { staff: { userId: user.id } } });
  if (!teacher || enrollment.assignedTeacherId !== teacher.id) {
    throw new ApiError(403, 'You are not assigned to this student\'s Hifz enrollment.');
  }
  return enrollment;
}

/**
 * Throws 403 unless the caller may mark/view attendance for this class
 * (+section +academic year). Coordinators/admin-tier roles are
 * unrestricted; a teacher must hold a matching TeacherClassAssignment —
 * never trust a classId/sectionId the client sent as proof of authority.
 */
async function assertCanManageClassAttendance(user, { classId, sectionId, academicYearId }) {
  const unrestricted = ['admin', 'super_admin', 'principal'];
  if (unrestricted.includes(user.role)) return;

  const teacher = await prisma.teacher.findFirst({ where: { staff: { userId: user.id } } });
  if (!teacher) throw new ApiError(403, 'You are not authorized to manage attendance for this class.');

  const assignment = await prisma.teacherClassAssignment.findFirst({
    where: {
      teacherId: teacher.id,
      classId,
      academicYearId,
      OR: [{ sectionId: null }, { sectionId: sectionId ?? undefined }],
    },
  });
  if (!assignment) {
    throw new ApiError(403, 'You are not assigned to teach this class/section.');
  }
}

/**
 * Throws 403 unless the caller may enter marks for this exam schedule's
 * class+subject. Admin/coordinator-tier roles are unrestricted; a teacher
 * must hold a matching TeacherClassAssignment for that class+subject —
 * never trust a scheduleId alone as proof the caller teaches that subject.
 */
async function assertCanEnterMarksForSchedule(user, schedule) {
  const unrestricted = ['admin', 'super_admin', 'principal'];
  if (unrestricted.includes(user.role)) return;

  const teacher = await prisma.teacher.findFirst({ where: { staff: { userId: user.id } } });
  if (!teacher) throw new ApiError(403, 'You are not authorized to enter marks for this exam.');

  const assignment = await prisma.teacherClassAssignment.findFirst({
    where: {
      teacherId: teacher.id,
      classId: schedule.classId,
      OR: [{ subjectId: null }, { subjectId: schedule.subjectId }],
    },
  });
  if (!assignment) {
    throw new ApiError(403, 'You are not assigned to teach this class/subject.');
  }
}

/**
 * Returns the caller's own TeacherClassAssignment rows (empty array for
 * non-teacher roles or a teacher with no assignments). Used to let the
 * Teacher "Add Student" UI auto-populate/limit department-class-section
 * choices to only what that teacher is actually assigned to (spec §20/
 * Step 12), and as the server-side source of truth checked below — the
 * frontend list is a convenience, never the authorization boundary.
 */
async function getTeacherAssignments(user) {
  if (!['teacher', 'hifz_teacher'].includes(user.role)) return [];
  const teacher = await prisma.teacher.findFirst({ where: { staff: { userId: user.id } } });
  if (!teacher) return [];
  return prisma.teacherClassAssignment.findMany({
    where: { teacherId: teacher.id },
    include: { class: { include: { department: true } }, section: true },
  });
}

/**
 * Throws 403 unless a teacher's proposed student placement (class +
 * optional section) matches one of their own TeacherClassAssignment rows.
 * Admin-tier roles are unrestricted. This is the server-side enforcement
 * for spec Step 12 ("Teacher cannot manually select an unrelated class or
 * section... Backend must enforce this again") — a teacher could otherwise
 * submit any classId/sectionId directly to POST /students regardless of
 * what the UI offers.
 */
async function assertTeacherCanPlaceStudent(user, { classId, sectionId }) {
  const unrestricted = ['admin', 'super_admin', 'principal'];
  if (unrestricted.includes(user.role)) return;
  if (classId === undefined || classId === null) {
    throw new ApiError(422, 'A class must be selected.');
  }

  const assignments = await getTeacherAssignments(user);
  const matches = assignments.some((a) => {
    if (a.classId !== classId) return false;
    // An assignment with no sectionId covers the whole class (any section);
    // one with a sectionId only covers that specific section.
    if (a.sectionId === null) return true;
    return sectionId !== undefined && sectionId !== null && a.sectionId === sectionId;
  });
  if (!matches) {
    throw new ApiError(403, 'You are not assigned to this class/section, so you cannot add or move a student there.');
  }
}

module.exports = {
  getAccessibleStudentIds,
  assertCanAccessStudent,
  assertCanManageHifzEnrollment,
  assertCanManageClassAttendance,
  assertCanEnterMarksForSchedule,
  getTeacherAssignments,
  assertTeacherCanPlaceStudent,
};
