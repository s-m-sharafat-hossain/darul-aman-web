const { z } = require('zod');

const createAssignmentSchema = z.object({
  classId: z.number().int(),
  sectionId: z.number().int().optional(),
  subjectId: z.number().int(),
  type: z.enum(['homework', 'assignment']).default('assignment'),
  title: z.string().min(2),
  instructions: z.string().optional(),
  attachmentUrl: z.string().url().optional(),
  totalMarks: z.number().positive().optional(),
  dueDate: z.string().optional(),
});

const updateAssignmentSchema = createAssignmentSchema.partial();

module.exports = { createAssignmentSchema, updateAssignmentSchema };
