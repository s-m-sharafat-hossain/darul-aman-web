const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const authRoutes = require('./modules/auth/auth.routes');
const studentsRoutes = require('./modules/students/students.routes');
const guardiansRoutes = require('./modules/guardians/guardians.routes');
const teachersRoutes = require('./modules/teachers/teachers.routes');
const academicRoutes = require('./modules/academic/academic.routes');
const attendanceRoutes = require('./modules/attendance/attendance.routes');
const hifzRoutes = require('./modules/hifz/hifz.routes');
const examsRoutes = require('./modules/exams/exams.routes');
const feesRoutes = require('./modules/fees/fees.routes');
const noticesRoutes = require('./modules/notices/notices.routes');
const servicesRoutes = require('./modules/services/services.routes');
const admissionsRoutes = require('./modules/admissions/admissions.routes');
const usersRoutes = require('./modules/users/users.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const assignmentsRoutes = require('./modules/assignments/assignments.routes');
const galleryRoutes = require('./modules/gallery/gallery.routes');

const app = express();

// --- Security & platform middleware ---
app.set('trust proxy', 1); // needed for correct req.ip behind a reverse proxy (rate limiting, audit logs)
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
      // origin is undefined for same-origin requests; 'null' string for file:// protocol
      if (!origin || allowed.includes(origin) || allowed.includes('null')) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true, // required so the httpOnly refresh-token cookie is sent
  })
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/api', apiLimiter);

// --- Health check (for uptime monitoring / load balancer) ---
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// --- Public gallery images ---
// Deliberately serves ONLY the gallery/ subfolder of UPLOAD_DIR, never the
// whole uploads directory — that directory also holds private student
// documents (see students.documents.controller.js), which stay behind
// requireAuth + assertCanAccessStudent and are never reachable via a plain
// static URL. Gallery images are the one upload type meant to be public
// (spec: gallery.html + Home Page "Recent Photos" load them with a plain
// <img src>, no auth token available on the public site).
// Cross-Origin-Resource-Policy is relaxed for just this route so the public
// site can load these images even when served from a different origin/port
// than the API (e.g. local dev) — helmet's default 'same-origin' would
// otherwise block that cross-origin <img> load.
app.use(
  '/uploads/gallery',
  (req, res, next) => {
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(process.env.UPLOAD_DIR || 'uploads', 'gallery'))
);

// --- API routes ---
// Every module's own router applies requireAuth internally where needed, so
// mounting order here doesn't itself grant access — see each *.routes.js.
app.use('/api/auth', authRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/guardians', guardiansRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/hifz', hifzRoutes);
app.use('/api/exams', examsRoutes);
app.use('/api/finance', feesRoutes);
app.use('/api/notices', noticesRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/admissions', admissionsRoutes);
app.use('/api/users', usersRoutes); // super admin: user/role/permission management + audit logs
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/gallery', galleryRoutes);

// --- 404 + error handling (must be last) ---
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
