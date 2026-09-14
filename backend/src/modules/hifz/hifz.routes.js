const express = require('express');
const controller = require('./hifz.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');

const router = express.Router();
router.use(requireAuth);

router.post('/enroll', requirePermission('hifz.create'), controller.enroll);
router.get('/student/:studentId/overview', controller.overview);
router.post('/evaluations', requirePermission('hifz.create'), controller.recordEvaluation);
router.post('/evaluations/bulk', requirePermission('hifz.create'), controller.recordBulkEvaluations);
router.post('/enrollments/:enrollmentId/para-completions', requirePermission('hifz.edit'), controller.markParaCompleted);
router.post('/enrollments/:enrollmentId/exams', requirePermission('hifz.create'), controller.recordExam);
router.post('/enrollments/:enrollmentId/certificate', requirePermission('hifz.approve'), controller.issueCertificate);
router.get('/my-roster', controller.teacherRoster); // Hifz teacher's own assigned students
router.get('/analytics', requirePermission('hifz.view'), controller.analytics);

module.exports = router;
