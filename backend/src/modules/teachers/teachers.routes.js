const express = require('express');
const controller = require('./teachers.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');

const router = express.Router();
router.use(requireAuth);

router.get('/', requirePermission('teacher.view'), controller.list);
router.get('/my-assignments', controller.myAssignments);
router.get('/:id', requirePermission('teacher.view'), controller.getOne);
router.post('/', requirePermission('teacher.create'), controller.create);
router.post('/:id/assignments', requirePermission('teacher.edit'), controller.assignClass);

module.exports = router;
