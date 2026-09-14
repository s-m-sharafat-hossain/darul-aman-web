const { z } = require('zod');

const markAttendanceEntrySchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(['present', 'absent', 'late', 'leave']),
  remarks: z.string().optional(),
});

const bulkMarkAttendanceSchema = z.object({
  classId: z.number().int(),
  sectionId: z.number().int().optional(),
  academicYearId: z.number().int(),
  attendanceDate: z.string(), // 'YYYY-MM-DD'
  entries: z.array(markAttendanceEntrySchema).min(1),
});

const editAttendanceSchema = z.object({
  status: z.enum(['present', 'absent', 'late', 'leave']),
  reason: z.string().min(3, 'A reason is required when editing submitted attendance.'),
});

module.exports = { bulkMarkAttendanceSchema, editAttendanceSchema };
