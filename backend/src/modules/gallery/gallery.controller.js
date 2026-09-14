const { z } = require('zod');
const service = require('./gallery.service');
const { ok, created, noContent } = require('../../utils/apiResponse');
const { asyncHandler, getPagination, paginationMeta } = require('../../utils/helpers');
const { recordAudit } = require('../../middleware/audit');

const CATEGORY_ENUM = z.enum(['academic', 'events', 'students', 'teachers', 'hifz', 'sports', 'cultural', 'campus', 'other']);

// multipart/form-data fields all arrive as strings — booleans/numbers are
// coerced here rather than relying on the client to send true JSON types.
const createSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(1000).optional(),
  category: CATEGORY_ENUM.default('other'),
  eventDate: z.string().optional(),
  isFeatured: z.coerce.boolean().optional(),
  isPublished: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const updateSchema = createSchema.partial();

const create = asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body);
  const item = await service.createGalleryItem(data, req.file, req.user.id);
  await recordAudit({ req, action: 'gallery.created', entityType: 'gallery_item', entityId: item.id, after: { title: item.title, category: item.category } });
  return created(res, item);
});

const update = asyncHandler(async (req, res) => {
  const data = updateSchema.parse(req.body);
  const item = await service.updateGalleryItem(req.params.id, data, req.file, req.user.id);
  await recordAudit({ req, action: 'gallery.updated', entityType: 'gallery_item', entityId: item.id });
  return ok(res, item);
});

const publish = asyncHandler(async (req, res) => {
  const item = await service.setPublished(req.params.id, true, req.user.id);
  await recordAudit({ req, action: 'gallery.published', entityType: 'gallery_item', entityId: item.id });
  return ok(res, item);
});

const unpublish = asyncHandler(async (req, res) => {
  const item = await service.setPublished(req.params.id, false, req.user.id);
  await recordAudit({ req, action: 'gallery.unpublished', entityType: 'gallery_item', entityId: item.id });
  return ok(res, item);
});

const remove = asyncHandler(async (req, res) => {
  const item = await service.deleteGalleryItem(req.params.id);
  await recordAudit({ req, action: 'gallery.deleted', entityType: 'gallery_item', entityId: item.id, before: { title: item.title } });
  return noContent(res);
});

const getOne = asyncHandler(async (req, res) => {
  const item = await service.getOne(req.params.id);
  return ok(res, item);
});

// Admin/staff listing (any authenticated user with gallery.view) — includes
// unpublished drafts, supports category/search/status filters + pagination.
const list = asyncHandler(async (req, res) => {
  const pagination = getPagination(req);
  const { category, search, status } = req.query;
  const isPublished = status === 'published' ? true : status === 'draft' ? false : undefined;

  const { items, total } = await service.listAdmin({
    category,
    search,
    isPublished,
    skip: pagination.skip,
    limit: pagination.limit,
  });
  return ok(res, items, paginationMeta(total, pagination.page, pagination.limit));
});

// Public: gallery.html grid + category filter. Only ever returns published items.
const listPublic = asyncHandler(async (req, res) => {
  const items = await service.listPublic({ category: req.query.category, limit: req.query.limit });
  return ok(res, items);
});

// Public: Home page "Recent Photos" — newest published items, small limit.
const listRecent = asyncHandler(async (req, res) => {
  const items = await service.listPublic({ limit: req.query.limit || 6 });
  return ok(res, items);
});

module.exports = { create, update, publish, unpublish, remove, getOne, list, listPublic, listRecent };
