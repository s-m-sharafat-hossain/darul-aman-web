const { z } = require('zod');

const loginSchema = z.object({
  identifier: z.string().min(3, 'Enter your User ID, email, or phone.'),
  password: z.string().min(1, 'Password is required.'),
  otp: z.string().optional(), // required only when the account has 2FA enabled
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10).optional(), // may also arrive via httpOnly cookie
});

const forgotPasswordSchema = z.object({
  identifier: z.string().min(3),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const registerSchema = z.object({
  role: z.enum(['student', 'guardian', 'teacher', 'staff']),
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().min(10, 'Phone number is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  // Student specific fields
  studentCode: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  // Guardian specific fields
  relation: z.string().optional(),
  guardianStudentCode: z.string().optional(),
  // Teacher specific fields
  staffCode: z.string().optional(),
  department: z.string().optional(),
  // Staff specific fields
  designation: z.string().optional(),
});

module.exports = {
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  registerSchema,
};
