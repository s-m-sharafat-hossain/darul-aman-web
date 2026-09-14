const prisma = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');

/** Confirms the class/section/subject combo is logically compatible before creating/updating an assignment. */
async function assertValidTeachingContext({ classId, sectionId, subjectId }) {
  const [klass, subject] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, include: { sections: true } }),
    prisma.subject.findUnique({ where: { id: subjectId } }),
  ]);
  if (!klass) throw new ApiError(422, 'Class not found.');
  if (!subject) throw new ApiError(422, 'Subject not found.');
  if (sectionId != null) {
    const belongs = klass.sections.some((s) => s.id === sectionId);
    if (!belongs) throw new ApiError(422, 'That section does not belong to the selected class.');
  }
}

async function createAssignment(data, teacherId) {
  await assertValidTeachingContext(data);
  return prisma.assignment.create({
    data: {
      ...data,
      teacherId,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    },
  });
}

async function listMine(teacherId) {
  return prisma.assignment.findMany({
    where: { teacherId },
    orderBy: { createdAt: 'desc' },
  });
}

async function getOwned(assignmentId, teacherId, isPrivileged) {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new ApiError(404, 'Assignment not found.');
  if (!isPrivileged && assignment.teacherId !== teacherId) {
    throw new ApiError(403, 'You can only manage assignments you created.');
  }
  return assignment;
}

async function updateAssignment(assignmentId, data, teacherId, isPrivileged) {
  const existing = await getOwned(assignmentId, teacherId, isPrivileged);
  if (data.classId || data.subjectId || data.sectionId !== undefined) {
    await assertValidTeachingContext({
      classId: data.classId ?? existing.classId,
      sectionId: data.sectionId !== undefined ? data.sectionId : existing.sectionId,
      subjectId: data.subjectId ?? existing.subjectId,
    });
  }
  return prisma.assignment.update({
    where: { id: assignmentId },
    data: { ...data, dueDate: data.dueDate ? new Date(data.dueDate) : undefined },
  });
}

async function deleteAssignment(assignmentId, teacherId, isPrivileged) {
  await getOwned(assignmentId, teacherId, isPrivileged);
  await prisma.assignment.delete({ where: { id: assignmentId } });
}

/** For a student: assignments for the class/section they currently belong to. */
async function listForStudent(studentId) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { currentClassId: true, currentSectionId: true } });
  if (!student || !student.currentClassId) return [];
  return prisma.assignment.findMany({
    where: {
      classId: student.currentClassId,
      OR: [{ sectionId: null }, { sectionId: student.currentSectionId || undefined }],
    },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = { createAssignment, listMine, getOwned, updateAssignment, deleteAssignment, listForStudent };
