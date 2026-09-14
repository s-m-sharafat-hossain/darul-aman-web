const { z } = require('zod');

const createExamSchema = z.object({
  academicYearId: z.number().int(),
  name: z.string().min(2),
  examType: z.enum(['monthly', 'half_yearly', 'annual', 'model_test', 'hifz_exam', 'class_test']),
  departmentId: z.number().int().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const createScheduleSchema = z.object({
  classId: z.number().int(),
  subjectId: z.number().int(),
  examDate: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  fullMarks: z.number(),
  passMarks: z.number(),
  roomNumber: z.string().optional(),
});

const enterMarksEntrySchema = z.object({
  studentId: z.string().uuid(),
  writtenMarks: z.number().min(0).optional(),
  oralMarks: z.number().min(0).optional(),
  practicalMarks: z.number().min(0).optional(),
  hifzMarks: z.number().min(0).optional(),
  isAbsent: z.boolean().optional(),
});

const enterMarksSchema = z.object({
  entries: z.array(enterMarksEntrySchema).min(1),
});

module.exports = { createExamSchema, createScheduleSchema, enterMarksSchema };
