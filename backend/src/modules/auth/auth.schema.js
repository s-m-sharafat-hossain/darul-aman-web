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

module.exports = {
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
};
