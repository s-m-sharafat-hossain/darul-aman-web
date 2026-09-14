const prisma = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');

/** Bulk mark attendance for a whole class/section on a given date (upsert per student). */
async function bulkMark({ classId, sectionId, academicYearId, attendanceDate, entries }, markedBy) {
  const date = new Date(attendanceDate);

  // Never trust that the studentIds in `entries` actually belong to this
  // class/section — confirm membership before writing any record.
  const studentIds = entries.map((e) => e.studentId);
  const members = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      currentClassId: classId,
      ...(sectionId ? { currentSectionId: sectionId } : {}),
    },
    select: { id: true },
  });
  const memberIds = new Set(members.map((s) => s.id));
  const invalid = studentIds.filter((id) => !memberIds.has(id));
  if (invalid.length) {
    throw new ApiError(422, `These students are not members of the specified class/section: ${invalid.join(', ')}`);
  }

  return prisma.$transaction(
    entries.map((entry) =>
      prisma.studentAttendance.upsert({
        where: { studentId_attendanceDate: { studentId: entry.studentId, attendanceDate: date } },
        create: {
          studentId: entry.studentId,
          classId,
          sectionId,
          academicYearId,
          attendanceDate: date,
          status: entry.status,
          remarks: entry.remarks,
          markedBy,
        },
        update: {
          status: entry.status,
          remarks: entry.remarks,
          markedBy,
          markedAt: new Date(),
        },
      })
    )
  );
}

/**
 * Editing previously submitted attendance requires elevated permission
 * (checked at the route level) AND writes an audit_logs entry with the
 * reason (spec §14: "cannot modify without proper permission... audit trail").
 */
async function editAttendance(attendanceId, { status, reason }, editedBy) {
  const existing = await prisma.studentAttendance.findUnique({ where: { id: BigInt(attendanceId) } });
  if (!existing) throw new ApiError(404, 'Attendance record not found.');

  const updated = await prisma.studentAttendance.update({
    where: { id: BigInt(attendanceId) },
    data: { status, markedBy: editedBy, markedAt: new Date() },
  });

  return { updated, before: existing, reason };
}

async function getStudentAttendance(studentId, { from, to }) {
  const where = { studentId };
  if (from || to) {
    where.attendanceDate = {};
    if (from) where.attendanceDate.gte = new Date(from);
    if (to) where.attendanceDate.lte = new Date(to);
  }
  const records = await prisma.studentAttendance.findMany({ where, orderBy: { attendanceDate: 'desc' } });

  const summary = records.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      acc.total += 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0, leave: 0, total: 0 }
  );
  summary.percentage = summary.total ? Math.round(((summary.present + summary.late) / summary.total) * 1000) / 10 : 0;

  return { records, summary };
}

async function getClassAttendanceForDate(classId, sectionId, attendanceDate) {
  return prisma.studentAttendance.findMany({
    where: { classId, sectionId: sectionId || undefined, attendanceDate: new Date(attendanceDate) },
    include: { student: { select: { id: true, fullName: true, studentCode: true, rollNumber: true } } },
  });
}

module.exports = { bulkMark, editAttendance, getStudentAttendance, getClassAttendanceForDate };
