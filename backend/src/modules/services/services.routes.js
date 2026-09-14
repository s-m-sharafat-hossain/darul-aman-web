const express = require('express');
const controller = require('./services.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');

const router = express.Router();
router.use(requireAuth);

// Leave applications
router.post('/leave', controller.applyLeave);
router.get('/leave/me', controller.myLeaveApplications);
router.get('/leave', requirePermission('leave.view'), controller.listLeaveApplications);
router.patch('/leave/:id', requirePermission('leave.approve'), controller.reviewLeave);

// General service requests (certificate/ID card/TC/document/complaint/application)
router.post('/requests', controller.createRequest);
router.get('/requests/me', controller.myRequests);
router.get('/requests', requirePermission('service_request.view'), controller.listRequests);
router.patch('/requests/:id', requirePermission('service_request.approve'), controller.resolveRequest);

module.exports = router;
