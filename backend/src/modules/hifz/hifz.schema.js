const { z } = require('zod');

const enrollSchema = z.object({
  studentId: z.string().uuid(),
  assignedTeacherId: z.string().uuid().optional(),
  startDate: z.string(),
  targetCompletionDate: z.string().optional(),
});

const qualityEnum = z.enum(['excellent', 'good', 'average', 'weak']);

const dailyEvaluationSchema = z.object({
  hifzEnrollmentId: z.string().uuid(),
  evaluationDate: z.string(),
  sabakParaId: z.number().int().optional(),
  sabakSurahId: z.number().int().optional(),
  sabakFromAyat: z.number().int().optional(),
  sabakToAyat: z.number().int().optional(),
  sabakQuality: qualityEnum.optional(),
  sabqiRange: z.string().optional(),
  sabqiQuality: qualityEnum.optional(),
  manzilRange: z.string().optional(),
  manzilQuality: qualityEnum.optional(),
  dailyTarget: z.string().optional(),
  dailyAchievement: z.string().optional(),
  mistakesCount: z.number().int().min(0).optional(),
  mistakesDetail: z.string().optional(),
  correctionNotes: z.string().optional(),
  teacherRemarks: z.string().optional(),
});

const paraCompletionSchema = z.object({
  paraId: z.number().int().min(1).max(30),
  completedDate: z.string(),
});

const hifzExamSchema = z.object({
  examDate: z.string(),
  examType: z.enum(['periodic', 'oral', 'completion_test']).default('periodic'),
  paraRange: z.string().optional(),
  marksObtained: z.number().optional(),
  fullMarks: z.number().optional(),
  grade: z.string().optional(),
  examinerRemarks: z.string().optional(),
});

const bulkEvaluationEntrySchema = z.object({
  studentId: z.string().uuid(),
  evaluationDate: z.string().optional(), // falls back to the batch-level date if omitted
  sabakParaId: z.number().int().optional(),
  sabakSurahId: z.number().int().optional(),
  sabakFromAyat: z.number().int().optional(),
  sabakToAyat: z.number().int().optional(),
  sabakQuality: qualityEnum.optional(),
  sabqiRange: z.string().optional(),
  sabqiQuality: qualityEnum.optional(),
  manzilRange: z.string().optional(),
  manzilQuality: qualityEnum.optional(),
  teacherRemarks: z.string().optional(),
});

const bulkEvaluationSchema = z.object({
  evaluationDate: z.string(),
  entries: z.array(bulkEvaluationEntrySchema).min(1).max(200),
});

module.exports = {
  enrollSchema,
  dailyEvaluationSchema,
  paraCompletionSchema,
  hifzExamSchema,
  bulkEvaluationSchema,
};
