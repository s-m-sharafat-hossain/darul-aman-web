const authService = require('./auth.service');
const {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  registerSchema,
} = require('./auth.schema');
const { ok } = require('../../utils/apiResponse');
const { asyncHandler } = require('../../utils/helpers');
const { recordAudit } = require('../../middleware/audit');
const { sendPasswordResetEmail } = require('../../utils/mailer');

// Refresh token is delivered as an httpOnly, secure cookie — never
// accessible to JS in the browser, which mitigates XSS token theft.
const REFRESH_COOKIE_NAME = 'daa_refresh_token';
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

const login = asyncHandler(async (req, res) => {
  const { identifier, password, otp } = loginSchema.parse(req.body);

  const result = await authService.login({
    identifier,
    password,
    otp,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTS);

  await recordAudit({
    req: { ...req, user: { id: result.user.id } },
    action: 'auth.login',
    entityType: 'user',
    entityId: result.user.id,
  });

  return ok(res, {
    accessToken: result.accessToken,
    user: result.user,
    redirectTo: result.redirectTo,
  });
});

const refreshToken = asyncHandler(async (req, res) => {
  // The refresh token is an httpOnly cookie set by the server — never
  // accept it from the request body, or a client-controlled value would
  // be usable to mint access tokens.
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  const result = await authService.refresh({ refreshToken: token });

  // Rotation: the old cookie value is now dead server-side (its hash no
  // longer matches the session), so always replace it with the new one.
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTS);

  return ok(res, { accessToken: result.accessToken });
});

const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  const userId = await authService.logout({ refreshToken: token });
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });

  if (userId) {
    await recordAudit({ req, action: 'auth.logout', entityType: 'user', entityId: userId });
  }
  return ok(res, { message: 'Logged out successfully.' });
});

const me = asyncHandler(async (req, res) => {
  // req.user is populated by requireAuth middleware from a fresh DB lookup,
  // so this doubles as a lightweight session-validity check for the SPA.
  return ok(res, { user: req.user });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  await authService.changePassword({ userId: req.user.id, currentPassword, newPassword });
  return ok(res, { message: 'Password changed successfully. Please log in again.' });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { identifier } = forgotPasswordSchema.parse(req.body);
  const result = await authService.requestPasswordReset(identifier);

  // Same response regardless of whether the account exists or the email
  // send succeeds — nothing here should let an attacker distinguish a
  // valid identifier from an invalid one (account-enumeration protection).
  if (result?.email) {
    await sendPasswordResetEmail({ to: result.email, resetToken: result.rawToken });
  }

  const payload = { message: 'If that account exists, a reset link has been sent.' };
  // Dev/staging convenience only — never expose the raw token in production.
  if (process.env.NODE_ENV !== 'production' && result?.rawToken) payload.devResetToken = result.rawToken;

  return ok(res, payload);
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = resetPasswordSchema.parse(req.body);
  await authService.resetPassword({ token, newPassword });
  return ok(res, { message: 'Password has been reset. Please log in.' });
});

const register = asyncHandler(async (req, res) => {
  const userData = registerSchema.parse(req.body);
  const result = await authService.register(userData);

  await recordAudit({
    req: { ...req, user: { id: result.user.id } },
    action: 'auth.register',
    entityType: 'user',
    entityId: result.user.id,
  });

  return ok(res, {
    message: 'Account created successfully. Please log in with your credentials.',
    user: result.user,
  });
});

module.exports = { login, refreshToken, logout, me, changePassword, forgotPassword, resetPassword, register };
