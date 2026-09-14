const express = require('express');
const controller = require('./assignments.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');

const router = express.Router();
router.use(requireAuth);

router.get('/teacher/mine', requirePermission('assignment.view'), controller.listMine);
router.get('/student/:studentId', controller.listForStudent); // ownership enforced in controller via assertCanAccessStudent
router.post('/', requirePermission('assignment.create'), controller.create);
router.patch('/:id', requirePermission('assignment.edit'), controller.update);
router.delete('/:id', requirePermission('assignment.delete'), controller.remove);

module.exports = router;
