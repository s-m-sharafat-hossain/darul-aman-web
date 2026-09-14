const { z } = require('zod');
const service = require('./notices.service');
const { ok, created } = require('../../utils/apiResponse');
const { asyncHandler } = require('../../utils/helpers');
const { recordAudit } = require('../../middleware/audit');

const createNoticeSchema = z
  .object({
    title: z.string().min(2),
    body: z.string().min(2),
    attachmentUrl: z.string().optional(),
    audience: z.enum(['all', 'students', 'guardians', 'teachers', 'staff', 'class_specific', 'department_specific']).default('all'),
    classId: z.number().int().optional(),
    departmentId: z.number().int().optional(),
  })
  .refine((d) => d.audience !== 'class_specific' || d.classId != null, {
    message: 'classId is required when audience is class_specific.',
    path: ['classId'],
  })
  .refine((d) => d.audience !== 'department_specific' || d.departmentId != null, {
    message: 'departmentId is required when audience is department_specific.',
    path: ['departmentId'],
  });

const create = asyncHandler(async (req, res) => {
  const data = createNoticeSchema.parse(req.body);
  const notice = await service.createNotice(data, req.user.id);
  return created(res, notice);
});

const publish = asyncHandler(async (req, res) => {
  const result = await service.publishNotice(req.params.id);
  await recordAudit({ req, action: 'notice.published', entityType: 'notice', entityId: req.params.id, after: { recipientCount: result.recipientCount } });
  return ok(res, result);
});

const list = asyncHandler(async (req, res) => {
  const notices = await service.listNotices(req.user);
  return ok(res, notices);
});

const listPublic = asyncHandler(async (req, res) => {
  const notices = await service.listPublicNotices();
  return ok(res, notices);
});

const myNotifications = asyncHandler(async (req, res) => {
  const unreadOnly = req.query.unreadOnly === 'true';
  const notifications = await service.getMyNotifications(req.user.id, { unreadOnly });
  return ok(res, notifications);
});

const markRead = asyncHandler(async (req, res) => {
  const result = await service.markNotificationRead(req.params.id, req.user.id);
  return ok(res, result);
});

const markAllRead = asyncHandler(async (req, res) => {
  await service.markAllRead(req.user.id);
  return ok(res, { message: 'All notifications marked read.' });
});

module.exports = { create, publish, list, listPublic, myNotifications, markRead, markAllRead };
