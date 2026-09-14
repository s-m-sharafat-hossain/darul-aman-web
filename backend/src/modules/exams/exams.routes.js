const express = require('express');
const controller = require('./exams.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');

const router = express.Router();
router.use(requireAuth);

router.post('/', requirePermission('exam.create'), controller.createExam);
router.get('/', requirePermission('exam.edit'), controller.listExams);
router.post('/:examId/schedules', requirePermission('exam.create'), controller.addSchedule);
router.post('/schedules/:scheduleId/marks', requirePermission('exam.edit'), controller.enterMarks);
router.get('/schedules/:scheduleId/marks', requirePermission('exam.edit'), controller.getScheduleMarks);
router.post('/:examId/publish', requirePermission('exam.approve'), controller.publishResults);
router.get('/student/:studentId/results', controller.studentResults);

module.exports = router;
