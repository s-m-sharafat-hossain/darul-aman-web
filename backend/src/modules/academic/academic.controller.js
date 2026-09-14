const { z } = require('zod');
const { Prisma } = require('@prisma/client');
const prisma = require('../../config/db');
const { ok, created } = require('../../utils/apiResponse');
const { asyncHandler } = require('../../utils/helpers');
const { recordAudit } = require('../../middleware/audit');

// ---- Schemas ----
const departmentSchema = z.object({ name: z.string().min(2), slug: z.string().min(2), description: z.string().optional(), displayOrder: z.number().int().optional() });
const classSchema = z.object({ departmentId: z.number().int(), name: z.string().min(1), displayOrder: z.number().int().optional() });
const sectionSchema = z.object({ classId: z.number().int(), name: z.string().min(1), roomNumber: z.string().optional(), capacity: z.number().int().optional() });
const subjectSchema = z.object({ departmentId: z.number().int().optional(), name: z.string().min(1), code: z.string().optional(), isHifzSubject: z.boolean().optional() });
const academicYearSchema = z.object({ name: z.string().min(4), startDate: z.string(), endDate: z.string(), isCurrent: z.boolean().optional() });
const routineSchema = z.object({
  classId: z.number().int(), sectionId: z.number().int(), subjectId: z.number().int(), teacherId: z.string().uuid(),
  academicYearId: z.number().int(), dayOfWeek: z.number().int().min(0).max(6), startTime: z.string(), endTime: z.string(), roomNumber: z.string().optional(),
});

// ---- Departments ----
const listDepartments = asyncHandler(async (req, res) => ok(res, await prisma.department.findMany({ orderBy: { displayOrder: 'asc' } })));
const createDepartment = asyncHandler(async (req, res) => {
  const data = departmentSchema.parse(req.body);
  const dept = await prisma.department.create({ data });
  return created(res, dept);
});

// ---- Classes ----
const listClasses = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.departmentId) where.departmentId = Number(req.query.departmentId);
  return ok(res, await prisma.class.findMany({ where, include: { sections: true, department: true }, orderBy: { displayOrder: 'asc' } }));
});
const createClass = asyncHandler(async (req, res) => {
  const data = classSchema.parse(req.body);
  const cls = await prisma.class.create({ data });
  return created(res, cls);
});

// ---- Sections ----
const createSection = asyncHandler(async (req, res) => {
  const data = sectionSchema.parse(req.body);
  const section = await prisma.section.create({ data });
  return created(res, section);
});

// ---- Subjects ----
const listSubjects = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.departmentId) where.departmentId = Number(req.query.departmentId);
  return ok(res, await prisma.subject.findMany({ where }));
});
const createSubject = asyncHandler(async (req, res) => {
  const data = subjectSchema.parse(req.body);
  const subject = await prisma.subject.create({ data });
  return created(res, subject);
});

// ---- Academic years ----
const listAcademicYears = asyncHandler(async (req, res) => ok(res, await prisma.academicYear.findMany({ orderBy: { startDate: 'desc' } })));
const createAcademicYear = asyncHandler(async (req, res) => {
  const data = academicYearSchema.parse(req.body);
  // Both writes must succeed together — a crash between them would leave
  // either zero "current" years (breaks anything defaulting to it) or,
  // under a concurrent request, briefly two. Serializable isolation also
  // closes the race between two admins creating a new current year at
  // the same moment (same pattern used in fees.service.js).
  const year = await prisma.$transaction(
    async (tx) => {
      if (data.isCurrent) {
        await tx.academicYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
      }
      return tx.academicYear.create({
        data: { ...data, startDate: new Date(data.startDate), endDate: new Date(data.endDate) },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
  return created(res, year);
});

// ---- Routines (class timetable) ----
const createRoutineEntry = asyncHandler(async (req, res) => {
  const data = routineSchema.parse(req.body);
  const entry = await prisma.routine.create({ data });
  await recordAudit({ req, action: 'routine.created', entityType: 'routine', entityId: entry.id });
  return created(res, entry);
});
const getClassRoutine = asyncHandler(async (req, res) => {
  const { classId, sectionId } = req.query;
  const routine = await prisma.routine.findMany({
    where: { classId: Number(classId), sectionId: sectionId ? Number(sectionId) : undefined },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  return ok(res, routine);
});

module.exports = {
  listDepartments, createDepartment,
  listClasses, createClass,
  createSection,
  listSubjects, createSubject,
  listAcademicYears, createAcademicYear,
  createRoutineEntry, getClassRoutine,
};
