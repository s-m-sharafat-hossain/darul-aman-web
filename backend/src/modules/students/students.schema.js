const { z } = require('zod');

const createStudentSchema = z.object({
  fullName: z.string().min(2),
  gender: z.enum(['male', 'female']).optional(),
  dateOfBirth: z.string().datetime().optional().or(z.string().optional()),
  bloodGroup: z.string().optional(),
  nationality: z.string().optional(),
  presentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  admissionDate: z.string().optional(),
  currentClassId: z.number().int().optional(),
  currentSectionId: z.number().int().optional(),
  departmentId: z.number().int().optional(),
  academicYearId: z.number().int().optional(),
  rollNumber: z.string().optional(),
  isHifzStudent: z.boolean().optional(),
  hifzTeacherId: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'transferred', 'graduated', 'archived']).optional(),
  guardians: z
    .array(
      z.object({
        guardianId: z.string().uuid().optional(), // link existing guardian
        fullName: z.string().optional(),           // or create a new guardian inline
        phone: z.string().optional(),
        email: z.string().email().optional(),
        relation: z.string(),
        isPrimary: z.boolean().optional(),
      })
    )
    .optional(),
});

const updateStudentSchema = createStudentSchema.partial();

const profileUpdateRequestSchema = z.object({
  fieldName: z.string().min(1),
  newValue: z.string().min(1),
});

const reviewProfileUpdateSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewNote: z.string().optional(),
});

const promoteStudentSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1),
  toClassId: z.number().int(),
  toSectionId: z.number().int().optional(),
  academicYearId: z.number().int(),
});

const transferStudentSchema = z.object({
  departmentId: z.number().int().optional(),
  classId: z.number().int(),
  sectionId: z.number().int().optional(),
  academicYearId: z.number().int().optional(),
});

module.exports = {
  createStudentSchema,
  updateStudentSchema,
  profileUpdateRequestSchema,
  reviewProfileUpdateSchema,
  promoteStudentSchema,
  transferStudentSchema,
};
