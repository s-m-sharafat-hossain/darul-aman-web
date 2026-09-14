const express = require('express');
const controller = require('./gallery.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { galleryUpload, verifyUploadedFileType } = require('../../middleware/upload');

const router = express.Router();

// --- Public, unauthenticated (spec §9: "Public GET endpoints should only
// expose published gallery items") ---
// Mounted before requireAuth below so these never hit the auth gate.
router.get('/public', controller.listPublic); // gallery.html grid (+ ?category=)
router.get('/recent', controller.listRecent); // home page "Recent Photos" (?limit=6)

router.use(requireAuth);

// --- Admin/staff (gallery.* permissions — seeded onto admin/principal) ---
router.get('/', requirePermission('gallery.view'), controller.list);
router.get('/:id', requirePermission('gallery.view'), controller.getOne);
router.post(
  '/',
  requirePermission('gallery.create'),
  galleryUpload.single('image'),
  verifyUploadedFileType,
  controller.create
);
router.put(
  '/:id',
  requirePermission('gallery.edit'),
  galleryUpload.single('image'),
  verifyUploadedFileType,
  controller.update
);
router.patch('/:id/publish', requirePermission('gallery.edit'), controller.publish);
router.patch('/:id/unpublish', requirePermission('gallery.edit'), controller.unpublish);
router.delete('/:id', requirePermission('gallery.delete'), controller.remove);

module.exports = router;
