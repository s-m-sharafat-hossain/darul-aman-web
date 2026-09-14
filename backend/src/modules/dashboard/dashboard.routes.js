const express = require('express');
const controller = require('./dashboard.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/student', requireRole('student'), controller.studentDashboard);
router.get('/guardian', requireRole('guardian'), controller.guardianDashboard);
router.get('/teacher', requireRole('teacher', 'hifz_teacher'), controller.teacherDashboard);
// Same set of roles as the frontend's admin-dashboard.js requireAuth() list —
// this endpoint only returns institution-wide aggregate counts (no
// per-student/per-payment detail), so front-office roles seeing it is a
// deliberate, safe match rather than a security relaxation.
router.get('/admin', requireRole('admin', 'super_admin', 'principal', 'accountant', 'receptionist', 'librarian'), controller.adminDashboard);

module.exports = router;
