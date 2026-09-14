# Darul Aman Academy — Management Portal Backend

Node.js + Express + PostgreSQL (via Prisma) REST API implementing the full
Madrasa ERP: unified role-based authentication, Student/Guardian/Teacher/
Hifz-Teacher/Admin/Super-Admin portals, academics, attendance, exams,
finance, Hifz-ul-Quran tracking, admissions, notices/notifications, student
services, and security/audit logging.

## Stack

- **Runtime**: Node.js 18+
- **Framework**: Express
- **Database**: PostgreSQL 14+, accessed via Prisma ORM
- **Auth**: JWT (short-lived access token + httpOnly-cookie refresh token),
  bcrypt password hashing, optional TOTP 2FA
- **Validation**: Zod on every write endpoint

## Getting started

```bash
cd backend
cp .env.example .env        # fill in DATABASE_URL, JWT secrets, CORS_ORIGIN
npm install
npx prisma migrate dev --name init   # creates tables from prisma/schema.prisma
npx prisma db seed                    # roles, permissions, departments/classes,
                                       # Quran Para reference data, demo accounts
npm run dev                           # starts on http://localhost:4000
```

Demo login credentials are printed to the console at the end of the seed
script (all fictional data, per spec §41). **Change or remove them before
any production deployment.**

## Architecture

```
src/
  app.js              Express app: security middleware + route mounting
  server.js            Entry point: DB connect, listen, graceful shutdown
  config/db.js         Shared Prisma client
  middleware/
    auth.js             requireAuth (JWT verify + live user/role lookup), requireRole
    rbac.js              requirePermission (role default + per-user override)
    audit.js             recordAudit() helper used by controllers
    errorHandler.js      Central error -> JSON response mapping
    rateLimiter.js        General + auth-specific rate limits
    upload.js             Secure multer config (MIME whitelist, randomized filenames)
  utils/
    jwt.js, password.js, apiResponse.js, helpers.js
    scope.js              getAccessibleStudentIds() / assertCanAccessStudent()
                           — the enforcement point for "never access another
                           role's data via URL" (spec §38)
  modules/<name>/
    <name>.schema.js       Zod input validation
    <name>.service.js      Business logic + Prisma queries
    <name>.controller.js   HTTP layer (parses input, calls service, shapes response)
    <name>.routes.js       Express router with auth/permission gates
```

### Modules implemented

| Module | Covers |
|---|---|
| `auth` | Unified login (user code/email/phone), role-derived redirect, refresh tokens, 2FA (TOTP), password reset, forced password change |
| `students` | CRUD, scope-restricted listing, portal account creation, profile-update-request/approval workflow, promotion |
| `guardians` | Creation + portal account, child linking, `my-children` for the child-switcher UI |
| `teachers` | Staff+Teacher creation, class/section/subject assignment, `my-assignments` |
| `academic` | Departments, classes, sections, subjects, academic years, routines |
| `attendance` | Bulk class marking, permission-gated edits with audit trail, per-student summary+percentage |
| `hifz` | Enrollment, daily Sabak/Sabqi/Manzil evaluation, Para completion tracking, Hifz exams, certificate issuance, teacher roster with "needs attention" flagging, admin analytics |
| `exams` | Exam/schedule creation, marks entry (written/oral/practical/hifz components), automatic GPA/grade computation, result publication, ranking |
| `fees` (mounted at `/api/finance`) | Invoices, payments (staff-recorded or guardian/student self-pay), discounts/scholarships, expenses, income/expense summary |
| `notices` | Notice creation/publish with audience targeting, fan-out to `notifications`, personal notification inbox |
| `services` | Leave applications, general service requests (certificate/ID/TC/document/complaint) with status workflow |
| `admissions` | Public application intake → staff review → approval → student + portal account creation, in one transaction |
| `users` | Super-admin: user creation/disable/activate/password-reset, role assignment, per-user permission overrides, role→permission catalogue editing, audit log viewer |
| `dashboard` | Aggregated home-screen data per role (student/guardian/teacher/admin) |

### Security model

- **Never trust the frontend for role/authorization.** `requireAuth` loads
  the user's current role fresh from the DB on every request (a disabled
  account or role change takes effect immediately, not at next token expiry).
- **Two authorization layers**: `requireRole` for coarse role gates (e.g.
  `/api/dashboard/admin`), `requirePermission` for fine-grained module.action
  checks that support per-user overrides on top of role defaults.
- **Scope enforcement** (`utils/scope.js`): student/guardian/teacher-scoped
  endpoints resolve which student IDs the caller may touch server-side —
  this is what stops a student from reading another student's record by
  editing a URL, independent of any frontend routing.
- **Audit logging**: sensitive mutations (login/logout, student/marks/
  attendance/fee changes, admission approval, user/permission changes) call
  `recordAudit()`, which never throws — a logging failure can't block the
  underlying action.
- **Passwords**: bcrypt, cost factor 12. **Refresh tokens**: httpOnly,
  `sameSite: strict`, secure-in-production cookie — inaccessible to XSS.
- **Rate limiting**: tighter limits specifically on `/api/auth/login` and
  password-reset to blunt brute force.
- **File uploads**: MIME-type whitelist, 10MB cap, filenames are
  server-generated random hex (never trusts the client-supplied name).

### What's intentionally stubbed for you to wire up

- **SMS/Email/Push delivery**: `notification_deliveries` table and the
  `notices` fan-out logic are in place; actual provider calls (Twilio,
  SES, FCM, etc.) are marked `TODO` in `auth.controller.js` /
  `notices.service.js` — plug in once you've chosen providers.
- **Online payment gateway**: `payments.gatewayReference` and
  `.env.example`'s `PAYMENT_GATEWAY_*` keys are in place; the actual
  gateway SDK integration (bKash/Stripe/SSLCommerz etc.) isn't, since spec
  §9 says "if a payment gateway is available."
- **PDF generation** for marksheets/certificates/ID cards/receipts
  (spec §25): `certificates`/`hifz_certificates` tables and issuance
  endpoints exist and return a record; rendering the actual PDF/template
  is a good next slice (e.g. via a headless-Chrome or PDFKit service) once
  the institution's letterhead/template assets are available.

## Next step

Once you share the existing public website's codebase, the frontend for
each portal will be built to match its design system (colors, typography,
components) and wired to this API, plus the "Portal Login" button added to
the existing navbar per spec §3.
