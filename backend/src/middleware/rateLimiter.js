const rateLimit = require('express-rate-limit');

// Generous general API limit — protects against abuse without hindering
// normal portal usage across a busy admin dashboard.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests, please try again later.' } },
});

// Tight limit specifically on login/password-reset to blunt brute-force and
// credential-stuffing attempts (spec §27: rate limiting, failed login tracking).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, error: { message: 'Too many login attempts. Please try again in a few minutes.' } },
});

// Tight limit on the public admission-application endpoint (no auth, open
// to the internet) to blunt automated spam/abuse without blocking a real
// family from submitting — a handful of attempts per IP per window is
// generous for a form someone fills out once.
const admissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many admission submissions from this connection. Please try again later or contact the school office directly.' } },
});

module.exports = { apiLimiter, authLimiter, admissionLimiter };
