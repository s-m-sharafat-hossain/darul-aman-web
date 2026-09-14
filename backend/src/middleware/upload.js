const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ApiError } = require('../utils/apiResponse');

// Whitelist by MIME type — never trust the client-supplied extension alone.
// This also doubles as the MIME -> extension map used to name stored files,
// so the extension on disk is always server-derived, never taken from the
// client's `originalname`.
const ALLOWED_MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Magic-byte (file signature) checks for the types above. This is a
// deliberately small, dependency-free check — not a full parser — but it's
// enough to catch the common attack of lying about Content-Type (e.g.
// claiming image/jpeg while uploading something else entirely). DOC/DOCX
// share broader container formats (OLE Compound File / ZIP) that can't be
// fully distinguished from their signature alone without a much heavier
// parser; that residual gap is called out explicitly below rather than
// papered over.
function matchesSignature(buffer, mimetype) {
  const b = buffer;
  switch (mimetype) {
    case 'image/jpeg':
      return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/png':
      return (
        b.length >= 8 &&
        b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
        b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
      );
    case 'image/webp':
      return (
        b.length >= 12 &&
        b.toString('ascii', 0, 4) === 'RIFF' &&
        b.toString('ascii', 8, 12) === 'WEBP'
      );
    case 'application/pdf':
      return b.length >= 4 && b.toString('ascii', 0, 4) === '%PDF';
    case 'application/msword':
      // Legacy .doc is an OLE Compound File.
      return (
        b.length >= 8 &&
        b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 &&
        b[4] === 0xa1 && b[5] === 0xb1 && b[6] === 0x1a && b[7] === 0xe1
      );
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      // .docx is a ZIP container. This confirms it's a ZIP at least — it
      // cannot, without unzipping and checking for word/document.xml,
      // distinguish a genuine .docx from an arbitrary same-signed ZIP. That
      // residual gap is accepted here to avoid pulling in a zip-parsing
      // dependency for a document type that isn't executable content.
      return b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07);
    default:
      return false;
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || 'uploads');
  },
  filename: (req, file, cb) => {
    // Never trust the client filename or its extension for the stored name
    // — that's both a path-traversal vector and a way to smuggle a
    // dangerous extension onto disk. The name is fully server-generated: a
    // random hex string plus an extension looked up from the whitelisted
    // MIME type map above, never from file.originalname.
    const randomName = crypto.randomBytes(24).toString('hex');
    const ext = ALLOWED_MIME_EXT[file.mimetype] || '';
    cb(null, `${randomName}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_EXT[file.mimetype]) {
    return cb(new ApiError(400, `File type not allowed: ${file.mimetype}`));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

// ---------------------------------------------------------------------------
// Gallery uploads (public website Gallery — spec §4/§14): images only, and
// stored in their own subfolder so the app can safely express.static-serve
// *just* that subfolder publicly (see app.js) without exposing the rest of
// UPLOAD_DIR, which also holds private student documents. Same
// never-trust-the-client-name / signature-verification approach as `upload`
// above — this only narrows the allowed MIME set and the destination.
const GALLERY_ALLOWED_MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const GALLERY_SUBDIR = 'gallery';

function galleryUploadDir() {
  return path.join(process.env.UPLOAD_DIR || 'uploads', GALLERY_SUBDIR);
}

// multer's diskStorage destination callback errors out if the directory
// doesn't exist yet — ensure it's there before the first upload rather than
// requiring it to be created manually as part of deployment.
function ensureGalleryDir() {
  const dir = galleryUploadDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const galleryStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ensureGalleryDir()),
  filename: (req, file, cb) => {
    const randomName = crypto.randomBytes(24).toString('hex');
    const ext = GALLERY_ALLOWED_MIME_EXT[file.mimetype] || '';
    cb(null, `${randomName}${ext}`);
  },
});

function galleryFileFilter(req, file, cb) {
  if (!GALLERY_ALLOWED_MIME_EXT[file.mimetype]) {
    return cb(new ApiError(400, `Image type not allowed: ${file.mimetype}. Use JPG, PNG or WEBP.`));
  }
  cb(null, true);
}

const galleryUpload = multer({
  storage: galleryStorage,
  fileFilter: galleryFileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

/**
 * Second-stage check to run AFTER upload.single/array/fields in the route
 * chain. multer's fileFilter only sees the client-supplied Content-Type
 * header for the part — it cannot inspect file content before the stream
 * is written to disk. This reads back the first bytes of each saved file
 * and confirms they actually match the claimed (whitelisted) type;
 * anything that doesn't match is deleted immediately and the request is
 * rejected, rather than left on disk under a trusted-looking extension.
 * Wired into POST /students/:id/documents (students.routes.js).
 */
function verifyUploadedFileType(req, res, next) {
  const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : req.file ? [req.file] : [];
  if (!files.length) return next();

  try {
    for (const file of files) {
      const fd = fs.openSync(file.path, 'r');
      const buf = Buffer.alloc(16);
      fs.readSync(fd, buf, 0, 16, 0);
      fs.closeSync(fd);

      if (!matchesSignature(buf, file.mimetype)) {
        for (const f of files) {
          fs.unlink(f.path, () => {});
        }
        return next(new ApiError(400, `File content does not match its declared type (${file.mimetype}).`));
      }
    }
    next();
  } catch (err) {
    for (const f of files) {
      fs.unlink(f.path, () => {});
    }
    next(err);
  }
}

module.exports = { upload, galleryUpload, galleryUploadDir, verifyUploadedFileType };
