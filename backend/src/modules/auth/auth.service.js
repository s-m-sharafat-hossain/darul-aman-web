const speakeasy = require('speakeasy');
const crypto = require('crypto');
const prisma = require('../../config/db');
const { hashPassword, comparePassword, validatePasswordStrength } = require('../../utils/password');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const { ApiError } = require('../../utils/apiResponse');
const { getRedirectPath } = require('./roleRedirects');

const MAX_FAILED_ATTEMPTS_WINDOW_MIN = 15;
const MAX_FAILED_ATTEMPTS = 8;

/** Finds a user by user_code, email, or phone — the unified login field. */
async function findUserByIdentifier(identifier) {
  return prisma.user.findFirst({
    where: {
      OR: [{ userCode: identifier }, { email: identifier }, { phone: identifier }],
    },
    include: { role: true },
  });
}

/** Basic brute-force guard on top of the express-rate-limit layer. */
async function assertNotLockedOut(identifier, ip) {
  const since = new Date(Date.now() - MAX_FAILED_ATTEMPTS_WINDOW_MIN * 60 * 1000);
  const count = await prisma.failedLoginAttempt.count({
    where: { identifier, attemptedAt: { gte: since } },
  }).catch(() => 0); // fail open on a DB error here rather than locking everyone out
  if (count >= MAX_FAILED_ATTEMPTS) {
    throw new ApiError(429, 'Too many failed attempts. Please try again later or reset your password.');
  }
}

async function recordLoginHistory({ userId, attemptedCode, success, ip, userAgent }) {
  await prisma.loginHistory.create({
    data: { userId: userId || null, attemptedCode, success, ipAddress: ip, userAgent },
  });
  // The lockout check in assertNotLockedOut() reads failed_login_attempts,
  // a separate table from login_history — it must be written here too, or
  // the lockout guard silently never trips (it did nothing but count rows
  // that were never inserted).
  if (!success) {
    await prisma.failedLoginAttempt.create({
      data: { identifier: attemptedCode, ipAddress: ip },
    }).catch(() => {}); // best-effort — a logging failure must never block/break login itself
  }
}

/**
 * Core login flow:
 *  1. Resolve identifier -> user (role loaded).
 *  2. Verify password.
 *  3. If 2FA enabled, verify OTP (TOTP) before issuing tokens.
 *  4. Issue access + refresh tokens, persist session, update last_login_at.
 *  5. Return redirect path derived from the user's ROLE — never from
 *     anything the client sent, per spec §4 ("never rely only on frontend
 *     role selection").
 */
async function login({ identifier, password, otp, ip, userAgent }) {
  await assertNotLockedOut(identifier, ip);

  const user = await findUserByIdentifier(identifier);

  if (!user || !user.isActive) {
    await recordLoginHistory({ userId: user?.id, attemptedCode: identifier, success: false, ip, userAgent });
    throw new ApiError(401, 'Invalid credentials.');
  }

  const passwordValid = await comparePassword(password, user.passwordHash);
  if (!passwordValid) {
    await recordLoginHistory({ userId: user.id, attemptedCode: identifier, success: false, ip, userAgent });
    throw new ApiError(401, 'Invalid credentials.');
  }

  if (user.twoFactorEnabled) {
    if (!otp) {
      // Signal the client to prompt for OTP without issuing tokens yet.
      const err = new ApiError(401, 'OTP required.');
      err.requiresOtp = true;
      throw err;
    }
    const otpValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: otp,
      window: 1,
    });
    if (!otpValid) {
      await recordLoginHistory({ userId: user.id, attemptedCode: identifier, success: false, ip, userAgent });
      throw new ApiError(401, 'Invalid OTP code.');
    }
  }

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: 'pending', // filled below once token is signed (needs session id)
      ipAddress: ip,
      userAgent,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const accessToken = signAccessToken({ id: user.id, role: user.role.name, userCode: user.userCode });
  const refreshToken = signRefreshToken({ id: user.id }, session.id);
  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  await prisma.session.update({ where: { id: session.id }, data: { refreshTokenHash } });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordLoginHistory({ userId: user.id, attemptedCode: identifier, success: true, ip, userAgent });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      userCode: user.userCode,
      email: user.email,
      phone: user.phone,
      role: user.role.name,
      mustChangePassword: user.mustChangePassword,
    },
    redirectTo: getRedirectPath(user.role.name),
  };
}

/**
 * Rotates the refresh token on every use (rotation-with-reuse-detection):
 *  1. Verify JWT signature/expiry.
 *  2. Look up the session by sid and compare the presented token's hash
 *     against the hash stored for that session.
 *  3. If the session is missing/revoked/expired, OR the hash doesn't
 *     match what's stored (i.e. this exact token was already rotated
 *     away or never belonged to this session), treat it as a possible
 *     theft/replay: revoke every active session for that user and force
 *     a fresh login.
 *  4. Otherwise, issue a brand-new access+refresh pair, store only the
 *     new refresh token's hash, and let the old one become invalid
 *     immediately (its hash no longer matches anything on the session).
 */
async function refresh({ refreshToken }) {
  if (!refreshToken) throw new ApiError(401, 'Refresh token required.');

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token.');
  }

  const session = await prisma.session.findUnique({ where: { id: payload.sid }, include: { user: { include: { role: true } } } });
  if (!session) throw new ApiError(401, 'Session is no longer valid. Please log in again.');

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  if (session.revokedAt || session.refreshTokenHash !== tokenHash) {
    // Reuse of a token that's already been rotated/revoked is a strong
    // signal the refresh token was stolen — kill every session for this
    // user rather than just this one.
    await prisma.session.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new ApiError(401, 'Session is no longer valid. Please log in again.');
  }

  if (session.expiresAt < new Date()) {
    throw new ApiError(401, 'Session is no longer valid. Please log in again.');
  }
  if (!session.user.isActive) throw new ApiError(401, 'Account is inactive.');

  const newRefreshToken = signRefreshToken({ id: session.user.id }, session.id);
  const newRefreshTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

  // Re-assert the old hash in the WHERE clause so two concurrent refresh
  // requests racing on the same (now-stale) token can't both succeed:
  // only the first writer rotates the session, the second sees 0 rows
  // updated and is treated as reuse.
  const rotated = await prisma.session.updateMany({
    where: { id: session.id, refreshTokenHash: tokenHash, revokedAt: null },
    data: {
      refreshTokenHash: newRefreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  if (rotated.count === 0) {
    // Lost the race (or was revoked in between) — don't hand out tokens.
    await prisma.session.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new ApiError(401, 'Session is no longer valid. Please log in again.');
  }

  const accessToken = signAccessToken({ id: session.user.id, role: session.user.role.name, userCode: session.user.userCode });

  return { accessToken, refreshToken: newRefreshToken };
}

async function logout({ refreshToken }) {
  if (!refreshToken) return;
  try {
    const payload = verifyRefreshToken(refreshToken);
    await prisma.session.update({ where: { id: payload.sid }, data: { revokedAt: new Date() } }).catch(() => {});
  } catch {
    // token already invalid/expired — nothing to revoke
  }
}

async function changePassword({ userId, currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, 'User not found.');

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw new ApiError(401, 'Current password is incorrect.');

  const strengthErrors = validatePasswordStrength(newPassword);
  if (strengthErrors.length) throw new ApiError(422, strengthErrors.join(' '));

  const passwordHash = await hashPassword(newPassword);

  // Password update and session revocation must succeed together — the
  // whole point of revoking sessions here is to invalidate any
  // compromised session at the moment of change; a crash between the two
  // writes would leave a stale session valid indefinitely.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

/** Issues a password reset token (caller is responsible for emailing/SMS-ing it). */
async function requestPasswordReset(identifier) {
  const user = await findUserByIdentifier(identifier);
  // Always behave the same whether or not the user exists, to avoid
  // account-enumeration via response timing/content.
  if (!user) return null;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  // Hand off to the notification/email layer at the call site. Returning
  // the email alongside the token avoids a second lookup (and any
  // resulting timing skew) in the controller.
  return { rawToken, email: user.email };
}

async function resetPassword({ token, newPassword }) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const record = await prisma.passwordResetToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!record) throw new ApiError(400, 'Invalid or expired reset link.');

  const strengthErrors = validatePasswordStrength(newPassword);
  if (strengthErrors.length) throw new ApiError(422, strengthErrors.join(' '));

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash, mustChangePassword: false } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

module.exports = {
  login,
  refresh,
  logout,
  changePassword,
  requestPasswordReset,
  resetPassword,
  findUserByIdentifier,
};
