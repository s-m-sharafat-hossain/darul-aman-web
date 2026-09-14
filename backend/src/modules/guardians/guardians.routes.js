const express = require('express');
const controller = require('./guardians.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');

const router = express.Router();
router.use(requireAuth);

router.post('/', requirePermission('guardian.create'), controller.create);
router.get('/my-children', controller.myChildren);
router.post('/:id/link-student', requirePermission('guardian.edit'), controller.linkStudent);

module.exports = router;
