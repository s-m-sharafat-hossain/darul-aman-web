const express = require('express');
const controller = require('./academic.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');

const router = express.Router();
router.use(requireAuth);

router.get('/departments', controller.listDepartments);
router.post('/departments', requirePermission('academic.create'), controller.createDepartment);

router.get('/classes', controller.listClasses);
router.post('/classes', requirePermission('academic.create'), controller.createClass);

router.post('/sections', requirePermission('academic.create'), controller.createSection);

router.get('/subjects', controller.listSubjects);
router.post('/subjects', requirePermission('academic.create'), controller.createSubject);

router.get('/years', controller.listAcademicYears);
router.post('/years', requirePermission('academic.create'), controller.createAcademicYear);

router.get('/routine', controller.getClassRoutine);
router.post('/routine', requirePermission('academic.create'), controller.createRoutineEntry);

module.exports = router;
