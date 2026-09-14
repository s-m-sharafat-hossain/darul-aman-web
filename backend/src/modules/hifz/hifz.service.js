const prisma = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { generateCode, withCodeRetry } = require('../../utils/helpers');

const TOTAL_PARAS = 30;

async function enrollStudent({ studentId, assignedTeacherId, startDate, targetCompletionDate }) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new ApiError(422, 'Student not found.');
  if (student.status !== 'active') throw new ApiError(422, 'Only active students can be enrolled in the Hifz program.');

  if (assignedTeacherId) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: assignedTeacherId },
      include: { staff: { select: { employmentStatus: true } } },
    });
    if (!teacher) throw new ApiError(422, 'Assigned teacher not found.');
    if (teacher.staff.employmentStatus !== 'active') throw new ApiError(422, 'Assigned teacher is not an active staff member.');
    if (teacher.teacherType !== 'hifz' && teacher.teacherType !== 'both') {
      throw new ApiError(422, 'Assigned teacher is not eligible to teach Hifz.');
    }
  }

  const existing = await prisma.hifzEnrollment.findUnique({ where: { studentId } });
  if (existing) throw new ApiError(409, 'Student is already enrolled in the Hifz program.');

  return prisma.$transaction(async (tx) => {
    const enrollment = await tx.hifzEnrollment.create({
      data: {
        studentId,
        assignedTeacherId,
        startDate: new Date(startDate),
        targetCompletionDate: targetCompletionDate ? new Date(targetCompletionDate) : null,
      },
    });
    await tx.student.update({
      where: { id: studentId },
      data: { isHifzStudent: true, hifzTeacherId: assignedTeacherId || null },
    });
    return enrollment;
  });
}

async function getOverview(studentId) {
  const enrollment = await prisma.hifzEnrollment.findUnique({
    where: { studentId },
    include: {
      dailyEvaluations: { orderBy: { evaluationDate: 'desc' }, take: 30 },
      paraCompletions: { orderBy: { paraId: 'asc' } },
      exams: { orderBy: { examDate: 'desc' }, take: 10 },
      certificate: true,
      teacher: { include: { staff: { select: { fullName: true, photoUrl: true } } } },
    },
  });
  if (!enrollment) throw new ApiError(404, 'This student is not enrolled in the Hifz program.');
  return enrollment;
}

/**
 * Records (or updates, if already logged today) a daily Sabak/Sabqi/Manzil
 * evaluation, and advances the enrollment's current-Para pointer when a new
 * Sabak Para was logged. Both writes are wrapped in one transaction: without
 * it, a crash or error between the two calls would leave an evaluation saved
 * with the enrollment's pointer never advanced to match it.
 */
async function recordDailyEvaluation(data, teacherId) {
  const date = new Date(data.evaluationDate);
  return prisma.$transaction(async (tx) => {
    const evaluation = await tx.hifzDailyEvaluation.upsert({
      where: {
        hifzEnrollmentId_evaluationDate: { hifzEnrollmentId: data.hifzEnrollmentId, evaluationDate: date },
      },
      create: { ...data, evaluationDate: date, teacherId },
      update: { ...data, evaluationDate: date, teacherId },
    });

    // If Sabak reached a new Para, update the enrollment's current pointer.
    if (data.sabakParaId) {
      await tx.hifzEnrollment.update({
        where: { id: data.hifzEnrollmentId },
        data: { currentParaId: data.sabakParaId, currentSurahId: data.sabakSurahId || undefined },
      });
    }

    return evaluation;
  });
}

/**
 * Marks a Para as fully completed and recalculates completion percentage.
 * The upsert, the recount, and the enrollment update are wrapped in one
 * transaction: read-then-write here is otherwise racy — two near-simultaneous
 * completions for the same enrollment could each recompute the count from a
 * stale read and write it back out of order, e.g. the 30th Para's completion
 * getting overwritten by the 29th's update finishing last, leaving a fully
 * complete enrollment marked 'ongoing' with the wrong parasCompleted count.
 */
async function markParaCompleted(hifzEnrollmentId, { paraId, completedDate }, verifiedBy) {
  return prisma.$transaction(async (tx) => {
    await tx.hifzParaCompletion.upsert({
      where: { hifzEnrollmentId_paraId: { hifzEnrollmentId, paraId } },
      create: { hifzEnrollmentId, paraId, completedDate: new Date(completedDate), verifiedBy },
      update: { completedDate: new Date(completedDate), verifiedBy },
    });

    const completedCount = await tx.hifzParaCompletion.count({ where: { hifzEnrollmentId } });
    const completionPercent = Math.round((completedCount / TOTAL_PARAS) * 10000) / 100;

    const isFullyComplete = completedCount >= TOTAL_PARAS;

    const updated = await tx.hifzEnrollment.update({
      where: { id: hifzEnrollmentId },
      data: {
        parasCompleted: completedCount,
        completionPercent,
        status: isFullyComplete ? 'completed' : 'ongoing',
        completedAt: isFullyComplete ? new Date() : null,
      },
    });

    return { updated, isFullyComplete };
  });
}

async function recordExam(hifzEnrollmentId, data, examinerId) {
  return prisma.hifzExam.create({
    data: { hifzEnrollmentId, examinerId, ...data, examDate: new Date(data.examDate) },
  });
}

/**
 * Issues a completion certificate once the enrollment status is 'completed'.
 * One certificate per enrollment is the intended rule (matches the
 * hifzEnrollmentId @unique constraint on HifzCertificate) — this must not
 * silently re-issue/overwrite an existing certificate on a repeat call
 * (double-click, retried request, a second coordinator acting on the same
 * enrollment, etc). The existence check and the create are done inside a
 * single transaction so two concurrent requests can't both pass the check
 * and then both attempt to create.
 */
async function issueCertificate(hifzEnrollmentId, issuedBy) {
  return withCodeRetry(
    () =>
      prisma.$transaction(async (tx) => {
        const enrollment = await tx.hifzEnrollment.findUnique({
          where: { id: hifzEnrollmentId },
          include: { certificate: true },
        });
        if (!enrollment) throw new ApiError(404, 'Hifz enrollment not found.');
        if (enrollment.status !== 'completed') {
          throw new ApiError(409, 'Certificate can only be issued once all 30 Paras are marked complete.');
        }
        if (enrollment.certificate) {
          throw new ApiError(409, 'A certificate has already been issued for this enrollment.');
        }

        return tx.hifzCertificate.create({
          data: {
            hifzEnrollmentId,
            certificateNumber: generateCode('HIFZ-CERT'),
            issuedDate: new Date(),
            issuedBy,
          },
        });
      }),
    'certificate_number'
  );
}

/**
 * Records a batch of daily evaluations in one request (one row per
 * student a teacher just finished listening to). Every entry is resolved
 * to its HifzEnrollment by studentId and — unless the caller is a
 * coordinator/admin — checked against the acting teacher's own roster;
 * a client can't evaluate a student who isn't actually assigned to them
 * just by including that studentId in the batch.
 *
 * The evaluation upserts and the Para-pointer advances both run inside one
 * transaction — same operations, same order as before, just atomic as a
 * unit now, so a failure partway through can't save some evaluations while
 * leaving their enrollments' pointers unadvanced (or vice versa).
 */
async function recordBulkEvaluations({ evaluationDate, entries }, teacherId, isPrivileged) {
  const studentIds = entries.map((e) => e.studentId);
  const enrollments = await prisma.hifzEnrollment.findMany({
    where: { studentId: { in: studentIds } },
    select: { id: true, studentId: true, assignedTeacherId: true },
  });
  const enrollmentByStudent = new Map(enrollments.map((e) => [e.studentId, e]));

  const accepted = [];
  const skipped = [];
  for (const entry of entries) {
    const enrollment = enrollmentByStudent.get(entry.studentId);
    if (!enrollment) {
      skipped.push({ studentId: entry.studentId, reason: 'Not enrolled in the Hifz program.' });
      continue;
    }
    if (!isPrivileged && enrollment.assignedTeacherId !== teacherId) {
      skipped.push({ studentId: entry.studentId, reason: 'Not assigned to you.' });
      continue;
    }
    accepted.push({ ...entry, hifzEnrollmentId: enrollment.id });
  }

  const saved = await prisma.$transaction(async (tx) => {
    const results = [];
    for (const entry of accepted) {
      const date = new Date(entry.evaluationDate || evaluationDate);
      const { studentId, evaluationDate: _drop, hifzEnrollmentId, ...rest } = entry;
      const evaluation = await tx.hifzDailyEvaluation.upsert({
        where: { hifzEnrollmentId_evaluationDate: { hifzEnrollmentId, evaluationDate: date } },
        create: { hifzEnrollmentId, evaluationDate: date, teacherId, ...rest },
        update: { evaluationDate: date, teacherId, ...rest },
      });
      results.push(evaluation);
    }

    // Advance each enrollment's current-Para pointer where a new Sabak Para was logged.
    for (const entry of accepted) {
      if (!entry.sabakParaId) continue;
      await tx.hifzEnrollment.update({
        where: { id: entry.hifzEnrollmentId },
        data: { currentParaId: entry.sabakParaId, currentSurahId: entry.sabakSurahId || undefined },
      });
    }

    return results;
  });

  return { saved: saved.length, skipped };
}

/** Teacher's roster: all students assigned to them with quick-glance progress + last evaluation date. */
async function getTeacherRoster(teacherId) {
  const enrollments = await prisma.hifzEnrollment.findMany({
    where: { assignedTeacherId: teacherId, status: { in: ['ongoing', 'paused'] } },
    include: {
      student: { select: { id: true, fullName: true, studentCode: true, photoUrl: true, currentClass: { select: { name: true } } } },
      dailyEvaluations: { orderBy: { evaluationDate: 'desc' }, take: 1 },
    },
  });

  // Flag students with no evaluation logged in the last 3 days as
  // "needing attention" — supports spec §15's weak-student identification.
  const now = Date.now();
  return enrollments.map((e) => {
    const lastEval = e.dailyEvaluations[0];
    const daysSinceLastEval = lastEval
      ? Math.floor((now - new Date(lastEval.evaluationDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    return {
      ...e,
      needsAttention: daysSinceLastEval === null || daysSinceLastEval > 3,
    };
  });
}

/**
 * Admin-facing Hifz analytics: aggregate completion stats and behind-schedule
 * flags. Pass teacherId to scope the result to a single teacher's own roster
 * (used for non-privileged callers); omit it for the unrestricted, school-wide
 * view (admin/super_admin/principal/hifz_coordinator only — enforced by the
 * controller, not here).
 */
async function getAnalytics(teacherId) {
  const enrollments = await prisma.hifzEnrollment.findMany({
    where: teacherId ? { assignedTeacherId: teacherId } : undefined,
    include: { student: { select: { fullName: true, studentCode: true } }, teacher: { include: { staff: { select: { fullName: true } } } } },
  });

  const totalStudents = enrollments.length;
  const completed = enrollments.filter((e) => e.status === 'completed').length;
  const ongoing = enrollments.filter((e) => e.status === 'ongoing').length;
  const avgCompletion =
    totalStudents > 0
      ? Math.round((enrollments.reduce((sum, e) => sum + Number(e.completionPercent), 0) / totalStudents) * 100) / 100
      : 0;

  const byTeacher = {};
  for (const e of enrollments) {
    const key = e.teacher?.staff?.fullName || 'Unassigned';
    byTeacher[key] = (byTeacher[key] || 0) + 1;
  }

  return { totalStudents, completed, ongoing, avgCompletion, byTeacher };
}

module.exports = {
  enrollStudent,
  getOverview,
  recordDailyEvaluation,
  recordBulkEvaluations,
  markParaCompleted,
  recordExam,
  issueCertificate,
  getTeacherRoster,
  getAnalytics,
};
