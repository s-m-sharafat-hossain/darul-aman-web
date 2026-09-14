const prisma = require('../../config/db');
const { ok } = require('../../utils/apiResponse');
const { asyncHandler } = require('../../utils/helpers');
const { ApiError } = require('../../utils/apiResponse');

/** Student dashboard: today's attendance, upcoming exam, fee status, notices, hifz snapshot. */
const studentDashboard = asyncHandler(async (req, res) => {
  const student = await prisma.student.findUnique({
    where: { userId: req.user.id },
    include: { currentClass: true, currentSection: true, department: true, hifzEnrollment: true },
  });
  if (!student) throw new ApiError(404, 'Student profile not found for this account.');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayAttendance, upcomingExams, invoices, notices, recentEval] = await Promise.all([
    prisma.studentAttendance.findUnique({ where: { studentId_attendanceDate: { studentId: student.id, attendanceDate: today } } }),
    prisma.examSchedule.findMany({
      where: { classId: student.currentClassId, examDate: { gte: today } },
      orderBy: { examDate: 'asc' },
      take: 5,
      include: { exam: { select: { name: true } } },
    }),
    prisma.studentFeeInvoice.findMany({ where: { studentId: student.id, status: { in: ['unpaid', 'partially_paid', 'overdue'] } } }),
    prisma.notice.findMany({ where: { isPublished: true, audience: { in: ['all', 'students'] } }, orderBy: { publishedAt: 'desc' }, take: 5 }),
    student.hifzEnrollment
      ? prisma.hifzDailyEvaluation.findFirst({ where: { hifzEnrollmentId: student.hifzEnrollment.id }, orderBy: { evaluationDate: 'desc' } })
      : null,
  ]);

  const totalDue = invoices.reduce((sum, i) => sum + (Number(i.amountDue) - Number(i.discountAmount) - Number(i.scholarshipAmount) - Number(i.amountPaid)), 0);

  return ok(res, {
    profile: student,
    todayAttendanceStatus: todayAttendance?.status || 'not_marked',
    upcomingExams,
    feeStatus: { totalDue: Math.max(0, totalDue), unpaidInvoiceCount: invoices.length },
    latestNotices: notices,
    hifzProgress: student.hifzEnrollment
      ? { completionPercent: student.hifzEnrollment.completionPercent, parasCompleted: student.hifzEnrollment.parasCompleted, lastEvaluation: recentEval }
      : null,
  });
});

/** Guardian dashboard: summary across all linked children. */
const guardianDashboard = asyncHandler(async (req, res) => {
  const guardian = await prisma.guardian.findUnique({
    where: { userId: req.user.id },
    include: { students: { include: { student: { include: { currentClass: true, hifzEnrollment: true } } } } },
  });
  if (!guardian) throw new ApiError(404, 'Guardian profile not found for this account.');

  const childSummaries = await Promise.all(
    guardian.students.map(async (sg) => {
      const student = sg.student;
      const invoices = await prisma.studentFeeInvoice.findMany({ where: { studentId: student.id, status: { in: ['unpaid', 'partially_paid', 'overdue'] } } });
      const totalDue = invoices.reduce((sum, i) => sum + (Number(i.amountDue) - Number(i.discountAmount) - Number(i.scholarshipAmount) - Number(i.amountPaid)), 0);
      return {
        id: student.id,
        fullName: student.fullName,
        studentCode: student.studentCode,
        class: student.currentClass?.name,
        relation: sg.relation,
        feeDue: Math.max(0, totalDue),
        hifzProgress: student.hifzEnrollment?.completionPercent ?? null,
      };
    })
  );

  const notices = await prisma.notice.findMany({ where: { isPublished: true, audience: { in: ['all', 'guardians'] } }, orderBy: { publishedAt: 'desc' }, take: 5 });

  return ok(res, { children: childSummaries, latestNotices: notices });
});

/** Teacher dashboard: today's routine, pending attendance/assignments, notices. */
const teacherDashboard = asyncHandler(async (req, res) => {
  const teacher = await prisma.teacher.findFirst({ where: { staff: { userId: req.user.id } } });
  if (!teacher) throw new ApiError(404, 'Teacher profile not found for this account.');

  const todayDow = new Date().getDay();
  const [todayRoutine, assignments, notices] = await Promise.all([
    prisma.routine.findMany({ where: { teacherId: teacher.id, dayOfWeek: todayDow }, orderBy: { startTime: 'asc' } }),
    prisma.assignment.findMany({ where: { teacherId: teacher.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.notice.findMany({ where: { isPublished: true, audience: { in: ['all', 'teachers'] } }, orderBy: { publishedAt: 'desc' }, take: 5 }),
  ]);

  return ok(res, { todayRoutine, recentAssignments: assignments, latestNotices: notices });
});

/** Admin dashboard: institution-wide statistics. */
const adminDashboard = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalStudents, activeStudents, hifzStudents, totalTeachers, totalStaff, todayAttendanceCount, absentToday, upcomingExamCount, financeSummary] =
    await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { status: 'active' } }),
      prisma.student.count({ where: { isHifzStudent: true } }),
      prisma.teacher.count(),
      prisma.staff.count(),
      prisma.studentAttendance.count({ where: { attendanceDate: today, status: 'present' } }),
      prisma.studentAttendance.count({ where: { attendanceDate: today, status: 'absent' } }),
      prisma.exam.count({ where: { startDate: { gte: today } } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) } } }),
    ]);

  const studentsByClass = await prisma.student.groupBy({ by: ['currentClassId'], _count: true, where: { status: 'active' } });
  const classIds = studentsByClass.map((c) => c.currentClassId).filter((id) => id != null);
  const classNames = classIds.length
    ? await prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } })
    : [];
  const classNameById = Object.fromEntries(classNames.map((c) => [c.id, c.name]));
  const studentsByClassNamed = studentsByClass.map((c) => ({
    classId: c.currentClassId,
    className: c.currentClassId != null ? classNameById[c.currentClassId] || 'Unknown' : 'Unassigned',
    count: c._count,
  }));

  return ok(res, {
    totalStudents,
    activeStudents,
    hifzStudents,
    totalTeachers,
    totalStaff,
    todayAttendance: { present: todayAttendanceCount, absent: absentToday },
    upcomingExamCount,
    monthlyFeeCollection: Number(financeSummary._sum.amount || 0),
    studentsByClass: studentsByClassNamed,
  });
});

module.exports = { studentDashboard, guardianDashboard, teacherDashboard, adminDashboard };
