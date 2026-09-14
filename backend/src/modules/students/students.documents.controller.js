const path = require('path');
const fs = require('fs');
const prisma = require('../../config/db');
const { ok, created, ApiError } = require('../../utils/apiResponse');
const { asyncHandler } = require('../../utils/helpers');
const { assertCanAccessStudent } = require('../../utils/scope');
const { recordAudit } = require('../../middleware/audit');

// Reuses the categories spec §15 asks for; a free-text fallback keeps this
// from blocking on a category the office hasn't thought of yet, while the
// UI still offers the named ones as the default choices.
const DOCUMENT_TYPES = new Set([
  'photo', 'birth_certificate', 'previous_result', 'transfer_certificate', 'other',
]);

const list = asyncHandler(async (req, res) => {
  await assertCanAccessStudent(req.user, req.params.id);
  const documents = await prisma.studentDocument.findMany({
    where: { studentId: req.params.id },
    orderBy: { createdAt: 'desc' },
    // fileUrl is deliberately never returned here — it's the server-side
    // storage path (never client input), not a browsable URL. The file
    // itself is only reachable through GET /:id/documents/:docId/file,
    // which re-checks scope before streaming it.
    select: { id: true, documentType: true, isVerified: true, createdAt: true, uploadedBy: true },
  });
  return ok(res, documents);
});

const upload = asyncHandler(async (req, res) => {
  await assertCanAccessStudent(req.user, req.params.id);
  if (!req.file) throw new ApiError(400, 'No file uploaded.');

  const documentType = DOCUMENT_TYPES.has(req.body.documentType) ? req.body.documentType : 'other';

  // req.file.filename is the server-generated random name from
  // middleware/upload.js's storage engine — never the client's
  // originalname — so this never stores an arbitrary client-supplied path.
  const doc = await prisma.studentDocument.create({
    data: {
      studentId: req.params.id,
      documentType,
      fileUrl: req.file.filename,
      uploadedBy: req.user.id,
    },
  });

  await recordAudit({
    req,
    action: 'student.document_uploaded',
    entityType: 'student_document',
    entityId: doc.id,
    after: { studentId: req.params.id, documentType },
  });

  return created(res, { id: doc.id, documentType: doc.documentType, createdAt: doc.createdAt });
});

const downloadFile = asyncHandler(async (req, res) => {
  await assertCanAccessStudent(req.user, req.params.id);
  const doc = await prisma.studentDocument.findUnique({ where: { id: req.params.docId } });
  if (!doc || doc.studentId !== req.params.id) throw new ApiError(404, 'Document not found.');

  const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
  const filePath = path.resolve(uploadDir, doc.fileUrl);
  // fileUrl is always a bare server-generated filename (see `upload`
  // above), but this guards against it ever resolving outside the upload
  // directory regardless — belt-and-braces against path traversal.
  if (!filePath.startsWith(uploadDir + path.sep)) throw new ApiError(400, 'Invalid file reference.');
  if (!fs.existsSync(filePath)) throw new ApiError(404, 'File not found on server.');

  return res.sendFile(filePath);
});

module.exports = { list, upload, downloadFile };
