const bcrypt = require('bcrypt');
const crypto = require('crypto');

const SALT_ROUNDS = 12;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/**
 * Generates a cryptographically secure temporary/reset password that
 * satisfies validatePasswordStrength() below (at least one uppercase,
 * one lowercase, one digit). Never use Math.random() for this — it's
 * not a CSPRNG and temp passwords are a security-sensitive value.
 */
function generateSecurePassword(length = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid visual ambiguity
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;

  function pick(charset) {
    return charset[crypto.randomInt(charset.length)];
  }

  const chars = [pick(upper), pick(lower), pick(digits)];
  while (chars.length < length) chars.push(pick(all));

  // Shuffle (Fisher-Yates) using crypto.randomInt so position doesn't leak which chars were the "guaranteed" ones.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Minimum password policy enforced server-side (never trust client-side
 * validation alone). Returns an array of violation messages; empty = valid.
 */
function validatePasswordStrength(password) {
  const errors = [];
  if (!password || password.length < 8) errors.push('Password must be at least 8 characters.');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter.');
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter.');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a number.');
  return errors;
}

module.exports = { hashPassword, comparePassword, validatePasswordStrength, generateSecurePassword };
