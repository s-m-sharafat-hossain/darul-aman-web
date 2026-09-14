const prisma = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { assertCanEnterMarksForSchedule } = require('../../utils/scope');

// Standard 5-point GPA grading scale (adjust to institution's actual scale
// as needed — kept centralized here so it changes in one place).
const GRADE_SCALE = [
  { min: 80, grade: 'A+', gpa: 5.0 },
  { min: 70, grade: 'A', gpa: 4.0 },
  { min: 60, grade: 'A-', gpa: 3.5 },
  { min: 50, grade: 'B', gpa: 3.0 },
  { min: 40, grade: 'C', gpa: 2.0 },
  { min: 33, grade: 'D', gpa: 1.0 },
  { min: 0, grade: 'F', gpa: 0.0 },
];

function gradeFor(percentage) {
  return GRADE_SCALE.find((g) => percentage >= g.min);
}

async function createExam(data) {
  return prisma.exam.create({
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
  });
}

async function addSchedule(examId, data) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new ApiError(404, 'Exam not found.');
  return prisma.examSchedule.create({ data: { examId, ...data, examDate: new Date(data.examDate) } });
}

async function enterMarks(scheduleId, entries, enteredBy, user) {
  const schedule = await prisma.examSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) throw new ApiError(404, 'Exam schedule not found.');

  await assertCanEnterMarksForSchedule(user, schedule);

  // Never trust that the studentIds in `entries` are actually members of
  // this schedule's class.
  const studentIds = entries.map((e) => e.studentId);
  const members = await prisma.student.findMany({
    where: { id: { in: studentIds }, currentClassId: schedule.classId },
    select: { id: true },
  });
  const memberIds = new Set(members.map((s) => s.id));
  const invalid = studentIds.filter((id) => !memberIds.has(id));
  if (invalid.length) {
    throw new ApiError(422, `These students are not members of this exam schedule's class: ${invalid.join(', ')}`);
  }

  return prisma.$transaction(
    entries.map((entry) => {
      const total = entry.isAbsent
        ? 0
        : [entry.writtenMarks, entry.oralMarks, entry.practicalMarks, entry.hifzMarks]
            .filter((v) => v !== undefined && v !== null)
            .reduce((a, b) => a + b, 0);
      const percentage = schedule.fullMarks > 0 ? (total / Number(schedule.fullMarks)) * 100 : 0;
      const g = gradeFor(percentage);

      return prisma.examMark.upsert({
        where: { examScheduleId_studentId: { examScheduleId: scheduleId, studentId: entry.studentId } },
        create: {
          examScheduleId: scheduleId,
          studentId: entry.studentId,
          writtenMarks: entry.writtenMarks,
          oralMarks: entry.oralMarks,
          practicalMarks: entry.practicalMarks,
          hifzMarks: entry.hifzMarks,
          totalMarks: total,
          grade: g.grade,
          isAbsent: Boolean(entry.isAbsent),
          enteredBy,
        },
        update: {
          writtenMarks: entry.writtenMarks,
          oralMarks: entry.oralMarks,
          practicalMarks: entry.practicalMarks,
          hifzMarks: entry.hifzMarks,
          totalMarks: total,
          grade: g.grade,
          isAbsent: Boolean(entry.isAbsent),
          enteredBy,
          enteredAt: new Date(),
        },
      });
    })
  );
}

/**
 * Aggregates all exam_marks across every schedule of an exam into a single
 * per-student result row (total, GPA, grade), then ranks students within
 * their class by total marks for position_in_class.
 *
 * Takes a Prisma client (`db`) rather than always using the top-level
 * `prisma` singleton so it can run either standalone (recalculation) or
 * as part of a larger transaction (see publishResults) — the interactive
 * transaction client has the same query API, so this function doesn't
 * need to know which one it got.
 */
async function computeAndUpsertResults(db, examId) {
  const schedules = await db.examSchedule.findMany({ where: { examId }, include: { marks: true } });
  if (!schedules.length) throw new ApiError(400, 'No exam schedules found for this exam.');

  const totalFull = schedules.reduce((sum, s) => sum + Number(s.fullMarks), 0);
  const byStudent = {};

  for (const schedule of schedules) {
    for (const mark of schedule.marks) {
      if (!byStudent[mark.studentId]) byStudent[mark.studentId] = 0;
      byStudent[mark.studentId] += Number(mark.totalMarks || 0);
    }
  }

  const ranked = Object.entries(byStudent)
    .map(([studentId, totalObtained]) => ({ studentId, totalObtained }))
    .sort((a, b) => b.totalObtained - a.totalObtained);

  // One write per student is unavoidable (each is a distinct compound-key
  // upsert), but they no longer run as sequential awaits in a loop — all
  // upserts are issued together and awaited as a batch.
  const writes = ranked.map(({ studentId, totalObtained }, i) => {
    const percentage = totalFull > 0 ? (totalObtained / totalFull) * 100 : 0;
    const g = gradeFor(percentage);
    return db.result.upsert({
      where: { examId_studentId: { examId, studentId } },
      create: {
        examId, studentId, totalObtained, totalFull,
        gpa: g.gpa, grade: g.grade, positionInClass: i + 1, isPass: g.grade !== 'F',
      },
      update: {
        totalObtained, totalFull, gpa: g.gpa, grade: g.grade, positionInClass: i + 1, isPass: g.grade !== 'F',
      },
    });
  });

  return Promise.all(writes);
}

/** Standalone recalculation (e.g. an admin re-running results after a marks correction), not tied to publishing. */
async function processResults(examId) {
  return prisma.$transaction((tx) => computeAndUpsertResults(tx, examId));
}

/**
 * Computing results and flipping the exam's published flag now happen in
 * one transaction — previously these were two separate un-transactioned
 * operations, so a crash between them could leave results computed but
 * the exam still marked unpublished (or, on a mid-loop failure, some
 * students' results written and others not).
 */
async function publishResults(examId, publishedBy) {
  return prisma.$transaction(async (tx) => {
    await computeAndUpsertResults(tx, examId);
    return tx.exam.update({
      where: { id: examId },
      data: { resultPublished: true, publishedAt: new Date(), publishedBy },
    });
  });
}

async function getStudentResults(studentId) {
  return prisma.result.findMany({
    where: { studentId, exam: { resultPublished: true } },
    include: { exam: { select: { name: true, examType: true, startDate: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function listExams(filters) {
  const where = {};
  if (filters.academicYearId) where.academicYearId = Number(filters.academicYearId);
  return prisma.exam.findMany({
    where,
    include: { schedules: { include: { class: true, subject: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function getScheduleMarks(scheduleId) {
  const schedule = await prisma.examSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) throw new ApiError(404, 'Exam schedule not found.');
  const [marks, students] = await Promise.all([
    prisma.examMark.findMany({ where: { examScheduleId: scheduleId } }),
    prisma.student.findMany({
      where: { currentClassId: schedule.classId },
      select: { id: true, fullName: true, rollNumber: true, studentCode: true },
      orderBy: { rollNumber: 'asc' },
    }),
  ]);
  const marksByStudent = Object.fromEntries(marks.map((m) => [m.studentId, m]));
  return { schedule, students: students.map((s) => ({ ...s, mark: marksByStudent[s.id] || null })) };
}

module.exports = {
  createExam, addSchedule, enterMarks, processResults, publishResults, getStudentResults, gradeFor,
  listExams, getScheduleMarks,
};
