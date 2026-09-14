-- ============================================================================
-- DARUL AMAN ACADEMY — MADRASA MANAGEMENT PORTAL
-- Database Schema (PostgreSQL 14+)
-- ============================================================================
-- Notes:
--  - UUID primary keys (gen_random_uuid()) for security (no enumerable IDs
--    exposed in URLs / APIs).
--  - Soft-delete via `is_active` / `archived_at` instead of hard deletes on
--    core records (students, teachers, users) to preserve history.
--  - All money stored as NUMERIC(12,2). All timestamps TIMESTAMPTZ.
--  - Enforce RBAC at the application/API layer; DB layer enforces referential
--    integrity, not authorization.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";        -- case-insensitive email

-- ============================================================================
-- SECTION 1: IDENTITY, ROLES & PERMISSIONS
-- ============================================================================

CREATE TABLE roles (
    id              SMALLSERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,        -- 'super_admin','admin','principal',
                                                   -- 'hifz_coordinator','teacher',
                                                   -- 'hifz_teacher','accountant',
                                                   -- 'receptionist','librarian',
                                                   -- 'guardian','student'
    description     TEXT,
    is_system_role  BOOLEAN NOT NULL DEFAULT FALSE, -- cannot be deleted (student/guardian/etc.)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id              SMALLSERIAL PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,        -- e.g. 'student.view','fee.approve'
    module          TEXT NOT NULL,               -- e.g. 'student','fee','hifz','exam'
    action          TEXT NOT NULL,               -- 'view','create','edit','delete','approve','reject','export','print'
    description     TEXT
);

CREATE TABLE role_permissions (
    role_id         SMALLINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   SMALLINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Central identity table. Every login (student, guardian, teacher, admin...)
-- has exactly one row here. Profile tables (students, teachers, guardians)
-- link back via user_id.
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_code           TEXT NOT NULL UNIQUE,      -- human-facing login ID e.g. DAA-STU-00231
    email               CITEXT UNIQUE,
    phone               TEXT UNIQUE,
    password_hash       TEXT NOT NULL,
    role_id             SMALLINT NOT NULL REFERENCES roles(id),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret   TEXT,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_role ON users(role_id);

-- Per-user permission overrides layered on top of role_permissions
-- (grant=true adds, grant=false explicitly revokes for that user).
CREATE TABLE user_permission_overrides (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id   SMALLINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    grant_flag      BOOLEAN NOT NULL,
    PRIMARY KEY (user_id, permission_id)
);

CREATE TABLE password_reset_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE login_history (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    attempted_code  TEXT,                          -- what was typed, even if invalid
    success         BOOLEAN NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_history_user ON login_history(user_id, created_at DESC);

CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- ============================================================================
-- SECTION 2: ACADEMIC STRUCTURE
-- ============================================================================

CREATE TABLE academic_years (
    id              SMALLSERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,   -- '2025-2026'
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    is_current      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE departments (
    id              SMALLSERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,   -- 'Play Group','Primary','Dakhil','Alim','Hifz','Islamic Studies','Arabic Studies'
    slug            TEXT NOT NULL UNIQUE,
    description     TEXT,
    display_order   SMALLINT DEFAULT 0
);

CREATE TABLE classes (
    id              SERIAL PRIMARY KEY,
    department_id   SMALLINT NOT NULL REFERENCES departments(id),
    name            TEXT NOT NULL,          -- 'Class 5', 'Dakhil 1st Year'
    display_order   SMALLINT DEFAULT 0,
    UNIQUE (department_id, name)
);

CREATE TABLE sections (
    id              SERIAL PRIMARY KEY,
    class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,          -- 'A','B'
    room_number     TEXT,
    capacity        SMALLINT,
    UNIQUE (class_id, name)
);

CREATE TABLE subjects (
    id              SERIAL PRIMARY KEY,
    department_id   SMALLINT REFERENCES departments(id),
    name            TEXT NOT NULL,
    code            TEXT UNIQUE,
    is_hifz_subject BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE class_subjects (               -- which subjects a class takes
    class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    academic_year_id SMALLINT NOT NULL REFERENCES academic_years(id),
    is_optional     BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (class_id, subject_id, academic_year_id)
);

CREATE TABLE syllabus (
    id              SERIAL PRIMARY KEY,
    class_subject_academic_year_id INTEGER,  -- optional link if you want strict FK; kept flexible below
    class_id        INTEGER NOT NULL REFERENCES classes(id),
    subject_id      INTEGER NOT NULL REFERENCES subjects(id),
    academic_year_id SMALLINT NOT NULL REFERENCES academic_years(id),
    title           TEXT NOT NULL,
    description     TEXT,
    file_url        TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE routines (                      -- class timetable
    id              SERIAL PRIMARY KEY,
    class_id        INTEGER NOT NULL REFERENCES classes(id),
    section_id      INTEGER NOT NULL REFERENCES sections(id),
    subject_id      INTEGER NOT NULL REFERENCES subjects(id),
    teacher_id      UUID NOT NULL,            -- references teachers(id), FK added after teachers table
    academic_year_id SMALLINT NOT NULL REFERENCES academic_years(id),
    day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    room_number     TEXT
);
CREATE INDEX idx_routines_class_section ON routines(class_id, section_id, day_of_week);

-- ============================================================================
-- SECTION 3: PEOPLE — STAFF, TEACHERS, GUARDIANS, STUDENTS
-- ============================================================================

CREATE TABLE designations (
    id              SMALLSERIAL PRIMARY KEY,
    title           TEXT NOT NULL UNIQUE     -- 'Principal','Senior Teacher','Accountant', etc.
);

CREATE TABLE staff (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    staff_code      TEXT NOT NULL UNIQUE,
    full_name       TEXT NOT NULL,
    photo_url       TEXT,
    designation_id  SMALLINT REFERENCES designations(id),
    department_id   SMALLINT REFERENCES departments(id),
    gender          TEXT CHECK (gender IN ('male','female')),
    date_of_birth   DATE,
    nid_or_passport TEXT,
    address         TEXT,
    joining_date    DATE,
    employment_status TEXT NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active','on_leave','resigned','terminated')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teachers are staff with subject-teaching duties. Kept as a distinct table
-- (rather than staff subtype flag) so hifz/general teacher queries stay simple.
CREATE TABLE teachers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        UUID NOT NULL UNIQUE REFERENCES staff(id) ON DELETE CASCADE,
    teacher_type    TEXT NOT NULL DEFAULT 'general' CHECK (teacher_type IN ('general','hifz','both')),
    specialization  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE routines ADD CONSTRAINT fk_routines_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id);

CREATE TABLE teacher_class_assignments (
    id              SERIAL PRIMARY KEY,
    teacher_id      UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    class_id        INTEGER NOT NULL REFERENCES classes(id),
    section_id      INTEGER REFERENCES sections(id),
    subject_id      INTEGER REFERENCES subjects(id),
    academic_year_id SMALLINT NOT NULL REFERENCES academic_years(id),
    is_class_teacher BOOLEAN NOT NULL DEFAULT FALSE,   -- homeroom / form teacher
    UNIQUE (teacher_id, class_id, section_id, subject_id, academic_year_id)
);

CREATE TABLE guardians (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name       TEXT NOT NULL,
    relation_default TEXT,                    -- 'Father','Mother','Uncle', display default
    phone           TEXT,
    email           CITEXT,
    occupation      TEXT,
    address         TEXT,
    photo_url       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE students (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL, -- null until portal account created
    student_code        TEXT NOT NULL UNIQUE,      -- Student ID
    registration_number TEXT UNIQUE,
    full_name           TEXT NOT NULL,
    photo_url            TEXT,
    gender              TEXT CHECK (gender IN ('male','female')),
    date_of_birth       DATE,
    blood_group         TEXT,
    nationality          TEXT,
    present_address      TEXT,
    permanent_address     TEXT,
    admission_date       DATE,
    admission_number     TEXT UNIQUE,
    current_class_id    INTEGER REFERENCES classes(id),
    current_section_id  INTEGER REFERENCES sections(id),
    department_id       SMALLINT REFERENCES departments(id),
    academic_year_id    SMALLINT REFERENCES academic_years(id),
    roll_number          TEXT,
    hifz_teacher_id      UUID REFERENCES teachers(id),   -- assigned Hifz teacher, if enrolled in Hifz
    is_hifz_student      BOOLEAN NOT NULL DEFAULT FALSE,
    status               TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','inactive','transferred','graduated','archived')),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_class_section ON students(current_class_id, current_section_id);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_name_trgm ON students USING gin (full_name gin_trgm_ops); -- requires pg_trgm

CREATE TABLE student_guardians (             -- many-to-many: guardian <-> student
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    guardian_id     UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
    relation        TEXT NOT NULL,           -- 'Father','Mother','Guardian'
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (student_id, guardian_id)
);

-- Enrollment history — one row per academic year per student (supports
-- promotion/transfer history without losing prior-year class data).
CREATE TABLE enrollments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academic_year_id SMALLINT NOT NULL REFERENCES academic_years(id),
    class_id        INTEGER NOT NULL REFERENCES classes(id),
    section_id      INTEGER REFERENCES sections(id),
    roll_number     TEXT,
    status          TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing','promoted','retained','transferred_out','graduated')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, academic_year_id)
);

CREATE TABLE student_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    document_type   TEXT NOT NULL,           -- 'birth_certificate','nid','previous_marksheet',...
    file_url        TEXT NOT NULL,
    uploaded_by     UUID REFERENCES users(id),
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Any student-initiated change to sensitive profile fields requires approval.
CREATE TABLE profile_update_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    requested_by    UUID NOT NULL REFERENCES users(id),
    field_name      TEXT NOT NULL,
    old_value       TEXT,
    new_value       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    reviewed_by     UUID REFERENCES users(id),
    review_note     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at     TIMESTAMPTZ
);

-- ============================================================================
-- SECTION 4: ADMISSIONS
-- ============================================================================

CREATE TABLE admission_applications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_number  TEXT NOT NULL UNIQUE,
    applicant_name       TEXT NOT NULL,
    date_of_birth        DATE,
    gender                TEXT CHECK (gender IN ('male','female')),
    applying_for_class_id INTEGER REFERENCES classes(id),
    applying_for_department_id SMALLINT REFERENCES departments(id),
    guardian_name         TEXT NOT NULL,
    guardian_phone        TEXT NOT NULL,
    guardian_email        CITEXT,
    address               TEXT,
    previous_school       TEXT,
    documents             JSONB,              -- array of {type, file_url}
    status                TEXT NOT NULL DEFAULT 'submitted'
                           CHECK (status IN ('submitted','under_review','correction_requested','approved','rejected')),
    reviewed_by            UUID REFERENCES users(id),
    review_note             TEXT,
    resulting_student_id    UUID REFERENCES students(id),
    submitted_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at              TIMESTAMPTZ
);

-- ============================================================================
-- SECTION 5: ATTENDANCE
-- ============================================================================

CREATE TABLE student_attendance (
    id              BIGSERIAL PRIMARY KEY,
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id        INTEGER NOT NULL REFERENCES classes(id),
    section_id      INTEGER REFERENCES sections(id),
    academic_year_id SMALLINT NOT NULL REFERENCES academic_years(id),
    attendance_date DATE NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('present','absent','late','leave')),
    remarks         TEXT,
    marked_by       UUID NOT NULL REFERENCES users(id),
    marked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, attendance_date)
);
CREATE INDEX idx_attendance_date ON student_attendance(attendance_date);
CREATE INDEX idx_attendance_class_date ON student_attendance(class_id, section_id, attendance_date);

-- Audit trail specifically for attendance edits (spec 14: no silent edits).
CREATE TABLE attendance_change_log (
    id              BIGSERIAL PRIMARY KEY,
    attendance_id   BIGINT NOT NULL REFERENCES student_attendance(id) ON DELETE CASCADE,
    changed_by      UUID NOT NULL REFERENCES users(id),
    old_status      TEXT,
    new_status      TEXT NOT NULL,
    reason          TEXT,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE staff_attendance (
    id              BIGSERIAL PRIMARY KEY,
    staff_id        UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('present','absent','late','leave')),
    marked_by       UUID REFERENCES users(id),
    UNIQUE (staff_id, attendance_date)
);

-- ============================================================================
-- SECTION 6: ASSIGNMENTS, HOMEWORK, STUDY MATERIALS, QUIZZES
-- ============================================================================

CREATE TABLE study_materials (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id        INTEGER NOT NULL REFERENCES classes(id),
    section_id      INTEGER REFERENCES sections(id),
    subject_id      INTEGER NOT NULL REFERENCES subjects(id),
    teacher_id      UUID NOT NULL REFERENCES teachers(id),
    title           TEXT NOT NULL,
    description     TEXT,
    file_url        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id        INTEGER NOT NULL REFERENCES classes(id),
    section_id      INTEGER REFERENCES sections(id),
    subject_id      INTEGER NOT NULL REFERENCES subjects(id),
    teacher_id      UUID NOT NULL REFERENCES teachers(id),
    type            TEXT NOT NULL DEFAULT 'assignment' CHECK (type IN ('homework','assignment')),
    title           TEXT NOT NULL,
    instructions    TEXT,
    attachment_url  TEXT,
    total_marks     NUMERIC(6,2),
    due_date        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assignment_submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    submitted_file_url TEXT,
    submission_text TEXT,
    submitted_at    TIMESTAMPTZ,
    obtained_marks  NUMERIC(6,2),
    teacher_remarks TEXT,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','late','reviewed')),
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ,
    UNIQUE (assignment_id, student_id)
);

CREATE TABLE quizzes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id        INTEGER NOT NULL REFERENCES classes(id),
    section_id      INTEGER REFERENCES sections(id),
    subject_id      INTEGER NOT NULL REFERENCES subjects(id),
    teacher_id      UUID NOT NULL REFERENCES teachers(id),
    title           TEXT NOT NULL,
    total_marks     NUMERIC(6,2) NOT NULL,
    duration_minutes SMALLINT,
    available_from  TIMESTAMPTZ,
    available_to    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quiz_questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id         UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text   TEXT NOT NULL,
    question_type   TEXT NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq','true_false','short_answer')),
    options         JSONB,                    -- [{key:'A', text:'...'}, ...]
    correct_answer  TEXT,
    marks           NUMERIC(6,2) NOT NULL DEFAULT 1,
    display_order   SMALLINT DEFAULT 0
);

CREATE TABLE quiz_submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id         UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    answers         JSONB,                    -- {question_id: answer}
    obtained_marks  NUMERIC(6,2),
    submitted_at    TIMESTAMPTZ,
    UNIQUE (quiz_id, student_id)
);

-- ============================================================================
-- SECTION 7: EXAMINATIONS & RESULTS
-- ============================================================================

CREATE TABLE exams (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id SMALLINT NOT NULL REFERENCES academic_years(id),
    name            TEXT NOT NULL,             -- 'Half-Yearly 2026'
    exam_type       TEXT NOT NULL CHECK (exam_type IN ('monthly','half_yearly','annual','model_test','hifz_exam','class_test')),
    department_id   SMALLINT REFERENCES departments(id),
    start_date      DATE,
    end_date        DATE,
    result_published BOOLEAN NOT NULL DEFAULT FALSE,
    published_at    TIMESTAMPTZ,
    published_by    UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE exam_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id         UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    class_id        INTEGER NOT NULL REFERENCES classes(id),
    subject_id      INTEGER NOT NULL REFERENCES subjects(id),
    exam_date       DATE NOT NULL,
    start_time      TIME,
    end_time        TIME,
    full_marks      NUMERIC(6,2) NOT NULL,
    pass_marks      NUMERIC(6,2) NOT NULL,
    room_number     TEXT
);

-- Marks broken down by component (written/oral/practical/hifz) per student.
CREATE TABLE exam_marks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_schedule_id UUID NOT NULL REFERENCES exam_schedules(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    written_marks   NUMERIC(6,2),
    oral_marks      NUMERIC(6,2),
    practical_marks NUMERIC(6,2),
    hifz_marks      NUMERIC(6,2),
    total_marks     NUMERIC(6,2),               -- computed at app layer, stored for reporting
    grade           TEXT,
    is_absent       BOOLEAN NOT NULL DEFAULT FALSE,
    entered_by      UUID REFERENCES users(id),
    entered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (exam_schedule_id, student_id)
);

-- Aggregated result per student per exam (GPA/grade summary + marksheet).
CREATE TABLE results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id         UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    total_obtained  NUMERIC(8,2),
    total_full      NUMERIC(8,2),
    gpa             NUMERIC(4,2),
    grade           TEXT,
    position_in_class SMALLINT,
    remarks         TEXT,
    is_pass         BOOLEAN,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (exam_id, student_id)
);

-- ============================================================================
-- SECTION 8: HIFZ-UL-QURAN MODULE (core differentiator — kept separate from
-- the general academic/exam tables above by design)
-- ============================================================================

-- Reference table: the 30 Para / Juz of the Quran, with Surah ranges — used
-- for progress calculation and display, not user-editable.
CREATE TABLE quran_paras (
    id              SMALLINT PRIMARY KEY,       -- 1-30
    name            TEXT NOT NULL,              -- 'Para 1 - Alif Lam Meem'
    starting_surah  TEXT,
    ending_surah    TEXT
);

CREATE TABLE quran_surahs (
    id              SMALLINT PRIMARY KEY,       -- 1-114
    name            TEXT NOT NULL,
    total_ayat      SMALLINT NOT NULL,
    para_start      SMALLINT REFERENCES quran_paras(id),
    para_end        SMALLINT REFERENCES quran_paras(id)
);

-- Overall Hifz enrollment record for a student — one row per student,
-- separate from `students` table to keep Hifz as its own bounded module.
CREATE TABLE hifz_enrollments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id          UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
    assigned_teacher_id UUID REFERENCES teachers(id),
    start_date          DATE NOT NULL,
    target_completion_date DATE,
    current_para_id     SMALLINT REFERENCES quran_paras(id),
    current_surah_id    SMALLINT REFERENCES quran_surahs(id),
    paras_completed     SMALLINT NOT NULL DEFAULT 0,
    completion_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing','completed','paused','discontinued')),
    completed_at        DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily Hifz evaluation — the heart of the module (Sabak/Sabqi/Manzil).
CREATE TABLE hifz_daily_evaluations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hifz_enrollment_id UUID NOT NULL REFERENCES hifz_enrollments(id) ON DELETE CASCADE,
    teacher_id      UUID NOT NULL REFERENCES teachers(id),
    evaluation_date DATE NOT NULL,
    -- Sabak: new lesson assigned/recited today
    sabak_para_id   SMALLINT REFERENCES quran_paras(id),
    sabak_surah_id  SMALLINT REFERENCES quran_surahs(id),
    sabak_from_ayat SMALLINT,
    sabak_to_ayat   SMALLINT,
    sabak_quality   TEXT CHECK (sabak_quality IN ('excellent','good','average','weak')),
    -- Sabqi: recent revision (yesterday's/this week's lesson)
    sabqi_range     TEXT,
    sabqi_quality   TEXT CHECK (sabqi_quality IN ('excellent','good','average','weak')),
    -- Manzil: long-term cumulative revision
    manzil_range    TEXT,
    manzil_quality  TEXT CHECK (manzil_quality IN ('excellent','good','average','weak')),
    daily_target    TEXT,
    daily_achievement TEXT,
    mistakes_count  SMALLINT DEFAULT 0,
    mistakes_detail TEXT,
    correction_notes TEXT,
    teacher_remarks TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (hifz_enrollment_id, evaluation_date)
);
CREATE INDEX idx_hifz_eval_date ON hifz_daily_evaluations(evaluation_date);
CREATE INDEX idx_hifz_eval_teacher ON hifz_daily_evaluations(teacher_id, evaluation_date);

CREATE TABLE hifz_para_completions (          -- log of when each Para was finished
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hifz_enrollment_id UUID NOT NULL REFERENCES hifz_enrollments(id) ON DELETE CASCADE,
    para_id         SMALLINT NOT NULL REFERENCES quran_paras(id),
    completed_date  DATE NOT NULL,
    verified_by     UUID REFERENCES teachers(id),
    UNIQUE (hifz_enrollment_id, para_id)
);

CREATE TABLE hifz_exams (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hifz_enrollment_id UUID NOT NULL REFERENCES hifz_enrollments(id) ON DELETE CASCADE,
    exam_date       DATE NOT NULL,
    exam_type       TEXT NOT NULL DEFAULT 'periodic' CHECK (exam_type IN ('periodic','oral','completion_test')),
    para_range      TEXT,
    marks_obtained  NUMERIC(6,2),
    full_marks      NUMERIC(6,2),
    grade           TEXT,
    examiner_id     UUID REFERENCES teachers(id),
    examiner_remarks TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hifz_certificates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hifz_enrollment_id UUID NOT NULL UNIQUE REFERENCES hifz_enrollments(id) ON DELETE CASCADE,
    certificate_number TEXT NOT NULL UNIQUE,
    issued_date     DATE NOT NULL,
    file_url        TEXT,
    issued_by       UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 9: FINANCE — FEES, PAYMENTS, EXPENSES
-- ============================================================================

CREATE TABLE fee_categories (
    id              SMALLSERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE       -- 'Admission','Tuition','Hifz','Exam','Hostel','Transport','Other'
);

CREATE TABLE fee_structures (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id SMALLINT NOT NULL REFERENCES academic_years(id),
    class_id        INTEGER REFERENCES classes(id),
    department_id   SMALLINT REFERENCES departments(id),
    fee_category_id SMALLINT NOT NULL REFERENCES fee_categories(id),
    amount          NUMERIC(12,2) NOT NULL,
    frequency       TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('one_time','monthly','term','yearly')),
    due_day_of_month SMALLINT
);

CREATE TABLE student_fee_invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_category_id SMALLINT NOT NULL REFERENCES fee_categories(id),
    academic_year_id SMALLINT NOT NULL REFERENCES academic_years(id),
    invoice_number  TEXT NOT NULL UNIQUE,
    billing_period  TEXT,                      -- e.g. 'January 2026'
    amount_due      NUMERIC(12,2) NOT NULL,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    scholarship_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    amount_paid     NUMERIC(12,2) NOT NULL DEFAULT 0,
    due_date        DATE,
    status          TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','partially_paid','paid','waived','overdue')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_student_status ON student_fee_invoices(student_id, status);

CREATE TABLE fee_discounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID NOT NULL REFERENCES student_fee_invoices(id) ON DELETE CASCADE,
    discount_type   TEXT NOT NULL CHECK (discount_type IN ('discount','scholarship')),
    amount          NUMERIC(12,2) NOT NULL,
    reason          TEXT,
    approved_by     UUID REFERENCES users(id),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID NOT NULL REFERENCES student_fee_invoices(id) ON DELETE CASCADE,
    receipt_number  TEXT NOT NULL UNIQUE,
    amount          NUMERIC(12,2) NOT NULL,
    payment_method  TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','bank','mobile_banking','card','online_gateway')),
    gateway_reference TEXT,                    -- external transaction id, if paid online
    paid_by         UUID REFERENCES users(id), -- guardian/student user who paid
    received_by     UUID REFERENCES users(id), -- staff who recorded it (cash)
    paid_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE expense_categories (
    id              SMALLSERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE       -- 'Salary','Utilities','Maintenance','Supplies','Other'
);

CREATE TABLE expenses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_category_id SMALLINT NOT NULL REFERENCES expense_categories(id),
    description     TEXT NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    expense_date    DATE NOT NULL,
    paid_to         TEXT,
    recorded_by     UUID NOT NULL REFERENCES users(id),
    attachment_url  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_date ON expenses(expense_date);

-- ============================================================================
-- SECTION 10: STUDENT SERVICES (leave, certificates, complaints, requests)
-- ============================================================================

CREATE TABLE leave_applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_user_id UUID NOT NULL REFERENCES users(id),   -- student or staff
    applicant_type  TEXT NOT NULL CHECK (applicant_type IN ('student','staff')),
    student_id      UUID REFERENCES students(id),
    staff_id        UUID REFERENCES staff(id),
    from_date       DATE NOT NULL,
    to_date         DATE NOT NULL,
    reason          TEXT NOT NULL,
    attachment_url  TEXT,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','processing')),
    reviewed_by     UUID REFERENCES users(id),
    review_note     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at     TIMESTAMPTZ
);

CREATE TABLE service_requests (               -- certificate/ID card/TC/document/general application/complaint
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_by    UUID NOT NULL REFERENCES users(id),
    student_id      UUID REFERENCES students(id),
    request_type    TEXT NOT NULL CHECK (request_type IN
                        ('certificate','id_card','transfer_certificate','document','complaint','general_application')),
    subject         TEXT NOT NULL,
    details         TEXT,
    attachment_url  TEXT,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','processing')),
    resolved_file_url TEXT,                   -- generated certificate/document, once ready
    handled_by      UUID REFERENCES users(id),
    handler_note    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ
);
CREATE INDEX idx_service_requests_status ON service_requests(status);

-- ============================================================================
-- SECTION 11: DOCUMENTS & CERTIFICATES (generated institutional documents)
-- ============================================================================

CREATE TABLE certificates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    certificate_type TEXT NOT NULL CHECK (certificate_type IN
                        ('id_card','admit_card','marksheet','testimonial','transfer_certificate','hifz_certificate','character_certificate')),
    certificate_number TEXT NOT NULL UNIQUE,
    related_exam_id UUID REFERENCES exams(id),
    file_url        TEXT,
    issued_by       UUID REFERENCES users(id),
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 12: NOTICES & NOTIFICATIONS
-- ============================================================================

CREATE TABLE notices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    attachment_url  TEXT,
    audience        TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','students','guardians','teachers','staff','class_specific','department_specific')),
    class_id        INTEGER REFERENCES classes(id),      -- when audience = class_specific
    department_id   SMALLINT REFERENCES departments(id), -- when audience = department_specific
    published_by    UUID NOT NULL REFERENCES users(id),
    published_at    TIMESTAMPTZ,
    is_published    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            TEXT NOT NULL CHECK (type IN
                        ('admission','attendance','assignment','exam','result','fee_due','payment_confirmation',
                         'hifz_evaluation','notice','leave_approval','certificate_ready','system')),
    title           TEXT NOT NULL,
    body            TEXT,
    related_entity_type TEXT,                 -- e.g. 'invoice','notice','result'
    related_entity_id   UUID,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- Delivery log for future SMS/Email/Push integration — decoupled so the
-- channel provider can be swapped without touching notifications table.
CREATE TABLE notification_deliveries (
    id              BIGSERIAL PRIMARY KEY,
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel         TEXT NOT NULL CHECK (channel IN ('in_app','sms','email','push')),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
    provider_response TEXT,
    sent_at         TIMESTAMPTZ
);

-- ============================================================================
-- SECTION 13: SECURITY & AUDIT
-- ============================================================================

CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    action          TEXT NOT NULL,             -- 'student.create','marks.update','fee.approve', etc.
    entity_type     TEXT,
    entity_id       TEXT,
    before_data     JSONB,
    after_data      JSONB,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

CREATE TABLE failed_login_attempts (
    id              BIGSERIAL PRIMARY KEY,
    identifier      TEXT NOT NULL,             -- email/phone/user_code attempted
    ip_address      INET,
    attempted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_failed_login_identifier ON failed_login_attempts(identifier, attempted_at);

-- Generic approval-workflow table, used for the cross-cutting approval
-- requirements in spec §39 (promotion, transfer, discount, result
-- publication, certificate generation, permission change) that don't already
-- have a dedicated status column above.
CREATE TABLE approval_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_type    TEXT NOT NULL,             -- 'promotion','transfer','discount','result_publication','permission_change'
    entity_type     TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    payload         JSONB,                     -- proposed change
    requested_by    UUID NOT NULL REFERENCES users(id),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    reviewed_by     UUID REFERENCES users(id),
    review_note     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at     TIMESTAMPTZ
);

-- ============================================================================
-- SECTION 14: FILE UPLOADS (generic secure file registry)
-- ============================================================================

CREATE TABLE files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id   UUID REFERENCES users(id),
    file_name       TEXT NOT NULL,
    file_path       TEXT NOT NULL,             -- storage key, not publicly guessable
    mime_type       TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    visibility      TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','institution','public')),
    related_entity_type TEXT,
    related_entity_id   TEXT,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- SEED: baseline roles (extend permissions/role_permissions at app-init time)
-- ============================================================================

INSERT INTO roles (name, is_system_role, description) VALUES
    ('super_admin', TRUE, 'Full system control'),
    ('admin', TRUE, 'Institutional administration'),
    ('principal', TRUE, 'Principal oversight'),
    ('hifz_coordinator', TRUE, 'Oversees Hifz department'),
    ('teacher', TRUE, 'General subject teacher'),
    ('hifz_teacher', TRUE, 'Hifz-ul-Quran teacher'),
    ('accountant', TRUE, 'Finance management'),
    ('receptionist', TRUE, 'Front-desk / admissions intake'),
    ('librarian', TRUE, 'Library management'),
    ('guardian', TRUE, 'Parent/guardian portal access'),
    ('student', TRUE, 'Student portal access');
