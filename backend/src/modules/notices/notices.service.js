const prisma = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');

async function createNotice(data, publishedBy) {
  return prisma.notice.create({ data: { ...data, publishedBy } });
}

/** Publishing a notice fans out an in-app notification to every user in its audience. */
async function publishNotice(noticeId) {
  const notice = await prisma.notice.findUnique({ where: { id: noticeId } });
  if (!notice) throw new ApiError(404, 'Notice not found.');

  await prisma.notice.update({ where: { id: noticeId }, data: { isPublished: true, publishedAt: new Date() } });

  const roleFilter = {
    all: undefined,
    students: { role: { name: 'student' } },
    guardians: { role: { name: 'guardian' } },
    teachers: { role: { name: { in: ['teacher', 'hifz_teacher'] } } },
    staff: { role: { name: { in: ['admin', 'accountant', 'receptionist', 'librarian', 'principal'] } } },
  }[notice.audience];

  let recipientWhere = roleFilter || {};
  if (notice.audience === 'class_specific' && notice.classId) {
    recipientWhere = { student: { currentClassId: notice.classId } };
  }
  if (notice.audience === 'department_specific' && notice.departmentId) {
    recipientWhere = { student: { departmentId: notice.departmentId } };
  }

  const recipients = await prisma.user.findMany({ where: { isActive: true, ...recipientWhere }, select: { id: true } });

  if (recipients.length) {
    await prisma.notification.createMany({
      data: recipients.map((r) => ({
        userId: r.id,
        type: 'notice',
        title: notice.title,
        body: notice.body,
        relatedEntityType: 'notice',
        relatedEntityId: notice.id,
      })),
    });
  }

  return { notice, recipientCount: recipients.length };
}

/**
 * Lists published notices visible to the caller. The audience is derived
 * entirely from the authenticated user's role/profile — a client-supplied
 * `audience` query param is never used for access control, since that
 * would let any user request another audience's notices.
 */
async function listNotices(user) {
  const unrestricted = ['admin', 'super_admin', 'principal'];
  if (unrestricted.includes(user.role)) {
    return prisma.notice.findMany({ where: { isPublished: true }, orderBy: { publishedAt: 'desc' }, take: 50 });
  }

  const audienceForRole = {
    student: 'students',
    guardian: 'guardians',
    teacher: 'teachers',
    hifz_teacher: 'teachers',
    hifz_coordinator: 'teachers',
    accountant: 'staff',
    receptionist: 'staff',
    librarian: 'staff',
  }[user.role];

  const orClauses = [{ audience: 'all' }];
  if (audienceForRole) orClauses.push({ audience: audienceForRole });

  let classIds = [];
  let departmentIds = [];

  if (user.role === 'student') {
    const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { currentClassId: true, departmentId: true } });
    if (student?.currentClassId) classIds.push(student.currentClassId);
    if (student?.departmentId) departmentIds.push(student.departmentId);
  } else if (user.role === 'guardian') {
    const guardian = await prisma.guardian.findUnique({
      where: { userId: user.id },
      include: { students: { include: { student: { select: { currentClassId: true, departmentId: true } } } } },
    });
    for (const sg of guardian?.students || []) {
      if (sg.student.currentClassId) classIds.push(sg.student.currentClassId);
      if (sg.student.departmentId) departmentIds.push(sg.student.departmentId);
    }
  } else if (['teacher', 'hifz_teacher'].includes(user.role)) {
    const teacher = await prisma.teacher.findFirst({ where: { staff: { userId: user.id } } });
    if (teacher) {
      const assignments = await prisma.teacherClassAssignment.findMany({ where: { teacherId: teacher.id }, select: { classId: true } });
      classIds = assignments.map((a) => a.classId);
    }
  }

  classIds = [...new Set(classIds)];
  departmentIds = [...new Set(departmentIds)];

  if (classIds.length) orClauses.push({ audience: 'class_specific', classId: { in: classIds } });
  if (departmentIds.length) orClauses.push({ audience: 'department_specific', departmentId: { in: departmentIds } });

  return prisma.notice.findMany({
    where: { isPublished: true, OR: orClauses },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  });
}

async function getMyNotifications(userId, { unreadOnly }) {
  return prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

async function markNotificationRead(id, userId) {
  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif || notif.userId !== userId) throw new ApiError(404, 'Notification not found.');
  return prisma.notification.update({ where: { id }, data: { isRead: true, readAt: new Date() } });
}

async function markAllRead(userId) {
  await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
}

/** Public website notice board — institution-wide, published notices only.
 * Deliberately excludes class/department/staff-only-audience notices, and
 * returns only fields safe for an unauthenticated visitor to see. */
async function listPublicNotices() {
  return prisma.notice.findMany({
    where: { isPublished: true, audience: 'all' },
    orderBy: { publishedAt: 'desc' },
    take: 10,
    select: { id: true, title: true, body: true, publishedAt: true },
  });
}

module.exports = { createNotice, publishNotice, listNotices, listPublicNotices, getMyNotifications, markNotificationRead, markAllRead };
