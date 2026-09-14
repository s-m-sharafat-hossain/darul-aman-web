const express = require('express');
const controller = require('./attendance.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');

const router = express.Router();
router.use(requireAuth);

router.post('/mark', requirePermission('attendance.create'), controller.bulkMark);
router.patch('/:id', requirePermission('attendance.edit'), controller.editOne); // elevated perm — edits are audited
router.get('/student/:studentId', controller.studentAttendance);
router.get('/class', requirePermission('attendance.view'), controller.classAttendance);

module.exports = router;
