const express = require('express');
const controller = require('./students.controller');
const documentsController = require('./students.documents.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { upload, verifyUploadedFileType } = require('../../middleware/upload');

const router = express.Router();

router.use(requireAuth);

// Listing/viewing is scope-filtered inside the controller (student sees
// self, guardian sees children, teacher sees assigned classes, staff sees all)
// rather than gated by a single permission, since "view" access legitimately
// differs by role+relationship, not just role.
router.get('/', controller.list);
router.get('/:id', controller.getOne);

router.post('/', requirePermission('student.create'), controller.create);
router.patch('/:id', requirePermission('student.edit'), controller.update);
router.post('/:id/portal-account', requirePermission('student.create'), controller.createPortalAccount);
router.post('/:id/profile-update-requests', controller.requestProfileUpdate); // student requests own change
router.patch('/profile-update-requests/:requestId', requirePermission('student.approve'), controller.reviewProfileUpdate);
router.post('/promote', requirePermission('student.edit'), controller.promote);
router.post('/:id/transfer', requirePermission('student.transfer'), controller.transfer);
router.post('/:id/archive', requirePermission('student.archive'), controller.archive);

// Documents (spec Step 7) — reuses the existing multer-based upload
// middleware (MIME whitelist) plus its second-stage magic-byte check,
// which existed but was not wired into any route before this. Scope is
// still enforced inside the controller via assertCanAccessStudent, same
// as GET /:id, so a teacher can only reach documents for students within
// their own assignment.
router.get('/:id/documents', documentsController.list);
router.get('/:id/documents/:docId/file', documentsController.downloadFile);
router.post(
  '/:id/documents',
  requirePermission('student.document.upload'), // admin/principal-only — see EXTRA_PERMISSIONS in seed.js; deliberately not student.edit, which teachers now also hold
  upload.single('file'),
  verifyUploadedFileType,
  documentsController.upload
);

module.exports = router;
