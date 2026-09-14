const express = require('express');
const controller = require('./admissions.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { admissionLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();

// Public — prospective applicants have no account yet. Dedicated rate
// limit since this is unauthenticated and open to the internet.
router.post('/apply', admissionLimiter, controller.apply);

// Staff-only from here on.
router.use(requireAuth);
router.get('/', requirePermission('admission.view'), controller.list);
router.get('/:id', requirePermission('admission.view'), controller.getOne);
router.patch('/:id/review', requirePermission('admission.approve'), controller.review);
router.post('/:id/finalize', requirePermission('admission.approve'), controller.finalizeAdmission);

module.exports = router;
