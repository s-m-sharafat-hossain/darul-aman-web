const fs = require('fs');
const path = require('path');
const prisma = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { galleryUploadDir } = require('../../middleware/upload');

const CATEGORIES = new Set([
  'academic', 'events', 'students', 'teachers', 'hifz', 'sports', 'cultural', 'campus', 'other',
]);

/** Deletes the on-disk image for a gallery item. Never throws — a missing
 * or already-removed file must not block the DB operation that triggered
 * this (delete/replace-image), it should just be a no-op. */
function deleteImageFile(imageUrl) {
  if (!imageUrl) return;
  const filename = path.basename(imageUrl); // imageUrl is always our own "/uploads/gallery/<name>" — never client input
  const filePath = path.join(galleryUploadDir(), filename);
  fs.unlink(filePath, () => {});
}

async function createGalleryItem(data, file, userId) {
  if (!file) throw new ApiError(400, 'An image is required.');

  let eventDate = new Date();
  if (data.eventDate && data.eventDate !== 'null' && data.eventDate !== 'undefined') {
    const parsed = new Date(data.eventDate);
    if (Number.isNaN(parsed.valueOf())) throw new ApiError(422, 'Invalid event date format.');
    eventDate = parsed;
  }

  const item = await prisma.galleryItem.create({
    data: {
      title: data.title,
      description: data.description === 'null' || !data.description ? null : data.description,
      imageUrl: `/uploads/gallery/${file.filename}`, // file.filename is server-generated — see middleware/upload.js
      category: CATEGORIES.has(data.category) ? data.category : 'other',
      eventDate,
      isFeatured: Boolean(data.isFeatured),
      isPublished: Boolean(data.isPublished),
      sortOrder: Number.isInteger(data.sortOrder) ? data.sortOrder : 0,
      createdBy: userId,
    },
  });
  return item;
}

async function updateGalleryItem(id, data, file, userId) {
  const existing = await prisma.galleryItem.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'Gallery item not found.');

  const updateData = { updatedBy: userId };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) {
    updateData.description = data.description === 'null' || !data.description ? null : data.description;
  }
  if (data.category !== undefined) updateData.category = CATEGORIES.has(data.category) ? data.category : 'other';
  
  if (data.eventDate !== undefined) {
    if (!data.eventDate || data.eventDate === 'null' || data.eventDate === 'undefined') {
      updateData.eventDate = null;
    } else {
      const parsed = new Date(data.eventDate);
      if (Number.isNaN(parsed.valueOf())) throw new ApiError(422, 'Invalid event date format.');
      updateData.eventDate = parsed;
    }
  }

  if (data.isFeatured !== undefined) updateData.isFeatured = Boolean(data.isFeatured);
  if (data.isPublished !== undefined) updateData.isPublished = Boolean(data.isPublished);
  if (data.sortOrder !== undefined && Number.isInteger(data.sortOrder)) updateData.sortOrder = data.sortOrder;

  // A new image was uploaded to replace the existing one — swap the URL and
  // clean up the old file only after the DB write succeeds, so a mid-way
  // failure never leaves the record pointing at a deleted file.
  if (file) updateData.imageUrl = `/uploads/gallery/${file.filename}`;

  const updated = await prisma.galleryItem.update({ where: { id }, data: updateData });
  if (file) deleteImageFile(existing.imageUrl);
  return updated;
}

async function setPublished(id, isPublished, userId) {
  const existing = await prisma.galleryItem.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'Gallery item not found.');
  return prisma.galleryItem.update({ where: { id }, data: { isPublished, updatedBy: userId } });
}

async function deleteGalleryItem(id) {
  const existing = await prisma.galleryItem.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'Gallery item not found.');
  await prisma.galleryItem.delete({ where: { id } });
  deleteImageFile(existing.imageUrl);
  return existing;
}

async function getOne(id) {
  const item = await prisma.galleryItem.findUnique({ where: { id } });
  if (!item) throw new ApiError(404, 'Gallery item not found.');
  return item;
}

/** Admin/staff listing — every item (published or not), optional category
 * and search filters, paginated. */
async function listAdmin({ category, search, isPublished, skip, limit }) {
  const where = {};
  if (category && CATEGORIES.has(category)) where.category = category;
  if (isPublished !== undefined) where.isPublished = isPublished;
  if (search) where.title = { contains: search };

  const [items, total] = await Promise.all([
    prisma.galleryItem.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.galleryItem.count({ where }),
  ]);
  return { items, total };
}

/** Public gallery page / homepage — published items only. `category`
 * filters the public gallery grid; `limit` (capped) powers the homepage's
 * "Recent Photos" strip. `featuredOnly` restricts to isFeatured=true when
 * the caller wants curated picks rather than the newest few. */
async function listPublic({ category, limit, featuredOnly }) {
  const where = { isPublished: true };
  if (category && category !== 'all' && CATEGORIES.has(category)) where.category = category;
  if (featuredOnly) where.isFeatured = true;

  const take = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 60);

  return prisma.galleryItem.findMany({
    where,
    orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }],
    take,
    select: {
      id: true, title: true, description: true, imageUrl: true,
      category: true, eventDate: true, isFeatured: true, createdAt: true,
    },
  });
}

module.exports = {
  CATEGORIES,
  createGalleryItem,
  updateGalleryItem,
  setPublished,
  deleteGalleryItem,
  getOne,
  listAdmin,
  listPublic,
};
