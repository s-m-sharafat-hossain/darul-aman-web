const express = require('express');
const controller = require('./notices.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');

const router = express.Router();

// Public, unauthenticated: surfaces already-published, institution-wide
// (audience:'all') notices for the public website's homepage notice board.
// No new data is exposed — these are the same notices every logged-in
// role already sees; only title/body/publishedAt are returned.
router.get('/public', controller.listPublic);

router.use(requireAuth);

router.post('/', requirePermission('notice.create'), controller.create);
router.post('/:id/publish', requirePermission('notice.create'), controller.publish);
router.get('/', controller.list);

// Personal notification inbox (any authenticated user)
router.get('/me/notifications', controller.myNotifications);
router.patch('/me/notifications/:id/read', controller.markRead);
router.patch('/me/notifications/read-all', controller.markAllRead);

module.exports = router;
