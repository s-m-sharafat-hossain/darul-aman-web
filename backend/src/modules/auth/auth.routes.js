const express = require('express');
const controller = require('./auth.controller');
const { requireAuth } = require('../../middleware/auth');
const { authLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();

// Public
router.post('/login', authLimiter, controller.login);
router.post('/register', authLimiter, controller.register);
router.post('/refresh', controller.refreshToken);
router.post('/forgot-password', authLimiter, controller.forgotPassword);
router.post('/reset-password', authLimiter, controller.resetPassword);

// Authenticated
router.post('/logout', controller.logout);
router.get('/me', requireAuth, controller.me);
router.post('/change-password', requireAuth, controller.changePassword);

module.exports = router;
