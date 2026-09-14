-- ============================================================================
-- Darul Aman Academy Portal — initial migration
-- Hand-authored from prisma/schema.prisma because this sandbox has no network
-- access, no Prisma CLI, and no PostgreSQL instance available, so
-- `prisma migrate dev` could not be run to auto-generate this file. Every
-- table/column/index/constraint below was derived directly from
-- prisma/schema.prisma, field by field, following Prisma's standard
-- PostgreSQL migration conventions (table/column names from @@map/@map,
-- @default(uuid()) => no DB-level default since Prisma generates the value
-- client-side, @default(autoincrement()) => SERIAL/BIGSERIAL,
-- @default(now()) => DEFAULT CURRENT_TIMESTAMP, Decimal with no @db.Decimal
-- => DECIMAL(65,30), Json => JSONB, DateTime with @db.Date => DATE,
-- DateTime otherwise => TIMESTAMP(3)).
--
-- IMPORTANT: this file was only statically verified against the schema —
-- it has NOT been applied to a real PostgreSQL database, and `prisma
-- validate`/`prisma generate` could not be run in this environment. See the
-- migration-verification report for full details and for a list of
-- schema.prisma fields that look like foreign keys by name but have no
-- @relation in the schema (and therefore intentionally have no FK
-- constraint below, per "do not change the schema to make this succeed").
-- ============================================================================

-- ----------------------------------------------------------------------------
-- IDENTITY, ROLES & PERMISSIONS
-- ----------------------------------------------------------------------------

CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_permissions" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "user_code" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_permission_overrides" (
    "user_id" TEXT NOT NULL,
    "permission_id" INTEGER NOT NULL,
    "grant_flag" BOOLEAN NOT NULL,

    CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("user_id","permission_id")
);

CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "login_history" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT,
    "attempted_code" TEXT,
    "success" BOOLEAN NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- ACADEMIC STRUCTURE
-- ----------------------------------------------------------------------------

CREATE TABLE "academic_years" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "classes" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sections" (
    "id" SERIAL NOT NULL,
    "class_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "room_number" TEXT,
    "capacity" INTEGER,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subjects" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "is_hifz_subject" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- STAFF, TEACHERS, GUARDIANS, STUDENTS
-- ----------------------------------------------------------------------------

CREATE TABLE "routines" (
    "id" SERIAL NOT NULL,
    "class_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "academic_year_id" INTEGER NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "room_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "designations" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "designations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "staff_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "photo_url" TEXT,
    "designation_id" INTEGER,
    "department_id" INTEGER,
    "gender" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "nid_or_passport" TEXT,
    "address" TEXT,
    "joining_date" TIMESTAMP(3),
    "employment_status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "teacher_type" TEXT NOT NULL DEFAULT 'general',
    "specialization" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "teacher_class_assignments" (
    "id" SERIAL NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "class_id" INTEGER NOT NULL,
    "section_id" INTEGER,
    "subject_id" INTEGER,
    "academic_year_id" INTEGER NOT NULL,
    "is_class_teacher" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_class_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guardians" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "relation_default" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "occupation" TEXT,
    "address" TEXT,
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "student_code" TEXT NOT NULL,
    "registration_number" TEXT,
    "full_name" TEXT NOT NULL,
    "photo_url" TEXT,
    "gender" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "blood_group" TEXT,
    "nationality" TEXT,
    "present_address" TEXT,
    "permanent_address" TEXT,
    "admission_date" TIMESTAMP(3),
    "admission_number" TEXT,
    "current_class_id" INTEGER,
    "current_section_id" INTEGER,
    "department_id" INTEGER,
    "academic_year_id" INTEGER,
    "roll_number" TEXT,
    "hifz_teacher_id" TEXT,
    "is_hifz_student" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_guardians" (
    "student_id" TEXT NOT NULL,
    "guardian_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "student_guardians_pkey" PRIMARY KEY ("student_id","guardian_id")
);

CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "academic_year_id" INTEGER NOT NULL,
    "class_id" INTEGER NOT NULL,
    "section_id" INTEGER,
    "roll_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ongoing',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_documents" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "uploaded_by" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_update_requests" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "profile_update_requests_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- ADMISSIONS
-- ----------------------------------------------------------------------------

CREATE TABLE "admission_applications" (
    "id" TEXT NOT NULL,
    "application_number" TEXT NOT NULL,
    "applicant_name" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3),
    "gender" TEXT,
    "applying_for_class_id" INTEGER,
    "applying_for_department_id" INTEGER,
    "guardian_name" TEXT NOT NULL,
    "guardian_phone" TEXT NOT NULL,
    "guardian_email" TEXT,
    "address" TEXT,
    "previous_school" TEXT,
    "documents" JSONB,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "resulting_student_id" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "admission_applications_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- ATTENDANCE
-- ----------------------------------------------------------------------------

CREATE TABLE "student_attendance" (
    "id" BIGSERIAL NOT NULL,
    "student_id" TEXT NOT NULL,
    "class_id" INTEGER NOT NULL,
    "section_id" INTEGER,
    "academic_year_id" INTEGER NOT NULL,
    "attendance_date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "remarks" TEXT,
    "marked_by" TEXT NOT NULL,
    "marked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_attendance_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- ASSIGNMENTS / QUIZZES
-- ----------------------------------------------------------------------------

CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "class_id" INTEGER NOT NULL,
    "section_id" INTEGER,
    "subject_id" INTEGER NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'assignment',
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "attachment_url" TEXT,
    "total_marks" DECIMAL(65,30),
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assignment_submissions" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "submitted_file_url" TEXT,
    "submission_text" TEXT,
    "submitted_at" TIMESTAMP(3),
    "obtained_marks" DECIMAL(65,30),
    "teacher_remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "class_id" INTEGER NOT NULL,
    "section_id" INTEGER,
    "subject_id" INTEGER NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "total_marks" DECIMAL(65,30) NOT NULL,
    "duration_minutes" INTEGER,
    "available_from" TIMESTAMP(3),
    "available_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quiz_submissions" (
    "id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "answers" JSONB,
    "obtained_marks" DECIMAL(65,30),
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "quiz_submissions_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- EXAMS & RESULTS
-- ----------------------------------------------------------------------------

CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "academic_year_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "exam_type" TEXT NOT NULL,
    "department_id" INTEGER,
    "start_date" DATE,
    "end_date" DATE,
    "result_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "published_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam_schedules" (
    "id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "class_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "exam_date" DATE NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "full_marks" DECIMAL(65,30) NOT NULL,
    "pass_marks" DECIMAL(65,30) NOT NULL,
    "room_number" TEXT,

    CONSTRAINT "exam_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam_marks" (
    "id" TEXT NOT NULL,
    "exam_schedule_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "written_marks" DECIMAL(65,30),
    "oral_marks" DECIMAL(65,30),
    "practical_marks" DECIMAL(65,30),
    "hifz_marks" DECIMAL(65,30),
    "total_marks" DECIMAL(65,30),
    "grade" TEXT,
    "is_absent" BOOLEAN NOT NULL DEFAULT false,
    "entered_by" TEXT,
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_marks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "results" (
    "id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "total_obtained" DECIMAL(65,30),
    "total_full" DECIMAL(65,30),
    "gpa" DECIMAL(65,30),
    "grade" TEXT,
    "position_in_class" INTEGER,
    "remarks" TEXT,
    "is_pass" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- HIFZ MODULE
-- ----------------------------------------------------------------------------

-- NOTE: id has no @default in schema.prisma (plain `Int @id`) — this is a
-- fixed reference table (Paras 1-30) whose rows the seed script must insert
-- with explicit id values; Postgres will NOT auto-generate them.
CREATE TABLE "quran_paras" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "starting_surah" TEXT,
    "ending_surah" TEXT,

    CONSTRAINT "quran_paras_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hifz_enrollments" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "assigned_teacher_id" TEXT,
    "start_date" DATE NOT NULL,
    "target_completion_date" DATE,
    "current_para_id" INTEGER,
    "current_surah_id" INTEGER,
    "paras_completed" INTEGER NOT NULL DEFAULT 0,
    "completion_percent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ongoing',
    "completed_at" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hifz_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hifz_daily_evaluations" (
    "id" TEXT NOT NULL,
    "hifz_enrollment_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "evaluation_date" DATE NOT NULL,
    "sabak_para_id" INTEGER,
    "sabak_surah_id" INTEGER,
    "sabak_from_ayat" INTEGER,
    "sabak_to_ayat" INTEGER,
    "sabak_quality" TEXT,
    "sabqi_range" TEXT,
    "sabqi_quality" TEXT,
    "manzil_range" TEXT,
    "manzil_quality" TEXT,
    "daily_target" TEXT,
    "daily_achievement" TEXT,
    "mistakes_count" INTEGER NOT NULL DEFAULT 0,
    "mistakes_detail" TEXT,
    "correction_notes" TEXT,
    "teacher_remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hifz_daily_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hifz_para_completions" (
    "id" TEXT NOT NULL,
    "hifz_enrollment_id" TEXT NOT NULL,
    "para_id" INTEGER NOT NULL,
    "completed_date" DATE NOT NULL,
    "verified_by" TEXT,

    CONSTRAINT "hifz_para_completions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hifz_exams" (
    "id" TEXT NOT NULL,
    "hifz_enrollment_id" TEXT NOT NULL,
    "exam_date" DATE NOT NULL,
    "exam_type" TEXT NOT NULL DEFAULT 'periodic',
    "para_range" TEXT,
    "marks_obtained" DECIMAL(65,30),
    "full_marks" DECIMAL(65,30),
    "grade" TEXT,
    "examiner_id" TEXT,
    "examiner_remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hifz_exams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hifz_certificates" (
    "id" TEXT NOT NULL,
    "hifz_enrollment_id" TEXT NOT NULL,
    "certificate_number" TEXT NOT NULL,
    "issued_date" DATE NOT NULL,
    "file_url" TEXT,
    "issued_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hifz_certificates_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- FINANCE
-- ----------------------------------------------------------------------------

CREATE TABLE "fee_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "fee_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_fee_invoices" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "fee_category_id" INTEGER NOT NULL,
    "academic_year_id" INTEGER NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "billing_period" TEXT,
    "amount_due" DECIMAL(65,30) NOT NULL,
    "discount_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "scholarship_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "due_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_fee_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fee_discounts" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "discount_type" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "reason" TEXT,
    "approved_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_discounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "payment_method" TEXT NOT NULL DEFAULT 'cash',
    "gateway_reference" TEXT,
    "paid_by" TEXT,
    "received_by" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expense_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "expense_category_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "expense_date" DATE NOT NULL,
    "paid_to" TEXT,
    "recorded_by" TEXT NOT NULL,
    "attachment_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- STUDENT SERVICES
-- ----------------------------------------------------------------------------

CREATE TABLE "leave_applications" (
    "id" TEXT NOT NULL,
    "applicant_user_id" TEXT NOT NULL,
    "applicant_type" TEXT NOT NULL,
    "student_id" TEXT,
    "staff_id" TEXT,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "attachment_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "leave_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "student_id" TEXT,
    "request_type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "details" TEXT,
    "attachment_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolved_file_url" TEXT,
    "handled_by" TEXT,
    "handler_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- DOCUMENTS / CERTIFICATES
-- ----------------------------------------------------------------------------

CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "certificate_type" TEXT NOT NULL,
    "certificate_number" TEXT NOT NULL,
    "related_exam_id" TEXT,
    "file_url" TEXT,
    "issued_by" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- NOTICES & NOTIFICATIONS
-- ----------------------------------------------------------------------------

CREATE TABLE "notices" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_url" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'all',
    "class_id" INTEGER,
    "department_id" INTEGER,
    "published_by" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "related_entity_type" TEXT,
    "related_entity_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- SECURITY & AUDIT
-- ----------------------------------------------------------------------------

CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "before_data" JSONB,
    "after_data" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "request_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "payload" JSONB,
    "requested_by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "failed_login_attempts" (
    "id" BIGSERIAL NOT NULL,
    "identifier" TEXT NOT NULL,
    "ip_address" TEXT,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_login_attempts_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- FILE UPLOADS
-- ----------------------------------------------------------------------------

CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "related_entity_type" TEXT,
    "related_entity_id" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- UNIQUE INDEXES
-- ============================================================================

CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");
CREATE UNIQUE INDEX "users_user_code_key" ON "users"("user_code");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE UNIQUE INDEX "academic_years_name_key" ON "academic_years"("name");
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");
CREATE UNIQUE INDEX "departments_slug_key" ON "departments"("slug");
CREATE UNIQUE INDEX "classes_department_id_name_key" ON "classes"("department_id", "name");
CREATE UNIQUE INDEX "sections_class_id_name_key" ON "sections"("class_id", "name");
CREATE UNIQUE INDEX "subjects_code_key" ON "subjects"("code");
CREATE UNIQUE INDEX "designations_title_key" ON "designations"("title");
CREATE UNIQUE INDEX "staff_user_id_key" ON "staff"("user_id");
CREATE UNIQUE INDEX "staff_staff_code_key" ON "staff"("staff_code");
CREATE UNIQUE INDEX "teachers_staff_id_key" ON "teachers"("staff_id");
CREATE UNIQUE INDEX "teacher_class_assignments_teacher_id_class_id_section_id_s_key" ON "teacher_class_assignments"("teacher_id", "class_id", "section_id", "subject_id", "academic_year_id");
CREATE UNIQUE INDEX "guardians_user_id_key" ON "guardians"("user_id");
CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");
CREATE UNIQUE INDEX "students_student_code_key" ON "students"("student_code");
CREATE UNIQUE INDEX "students_registration_number_key" ON "students"("registration_number");
CREATE UNIQUE INDEX "students_admission_number_key" ON "students"("admission_number");
CREATE UNIQUE INDEX "enrollments_student_id_academic_year_id_key" ON "enrollments"("student_id", "academic_year_id");
CREATE UNIQUE INDEX "admission_applications_application_number_key" ON "admission_applications"("application_number");
CREATE UNIQUE INDEX "admission_applications_resulting_student_id_key" ON "admission_applications"("resulting_student_id");
CREATE UNIQUE INDEX "student_attendance_student_id_attendance_date_key" ON "student_attendance"("student_id", "attendance_date");
CREATE UNIQUE INDEX "assignment_submissions_assignment_id_student_id_key" ON "assignment_submissions"("assignment_id", "student_id");
CREATE UNIQUE INDEX "quiz_submissions_quiz_id_student_id_key" ON "quiz_submissions"("quiz_id", "student_id");
CREATE UNIQUE INDEX "exam_marks_exam_schedule_id_student_id_key" ON "exam_marks"("exam_schedule_id", "student_id");
CREATE UNIQUE INDEX "results_exam_id_student_id_key" ON "results"("exam_id", "student_id");
CREATE UNIQUE INDEX "hifz_enrollments_student_id_key" ON "hifz_enrollments"("student_id");
CREATE UNIQUE INDEX "hifz_daily_evaluations_hifz_enrollment_id_evaluation_date_key" ON "hifz_daily_evaluations"("hifz_enrollment_id", "evaluation_date");
CREATE UNIQUE INDEX "hifz_para_completions_hifz_enrollment_id_para_id_key" ON "hifz_para_completions"("hifz_enrollment_id", "para_id");
CREATE UNIQUE INDEX "hifz_certificates_hifz_enrollment_id_key" ON "hifz_certificates"("hifz_enrollment_id");
CREATE UNIQUE INDEX "hifz_certificates_certificate_number_key" ON "hifz_certificates"("certificate_number");
CREATE UNIQUE INDEX "fee_categories_name_key" ON "fee_categories"("name");
CREATE UNIQUE INDEX "student_fee_invoices_invoice_number_key" ON "student_fee_invoices"("invoice_number");
CREATE UNIQUE INDEX "payments_receipt_number_key" ON "payments"("receipt_number");
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");
CREATE UNIQUE INDEX "certificates_certificate_number_key" ON "certificates"("certificate_number");

-- ============================================================================
-- PLAIN INDEXES
-- ============================================================================

CREATE INDEX "users_role_id_idx" ON "users"("role_id");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");
CREATE INDEX "login_history_user_id_idx" ON "login_history"("user_id");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX "subjects_department_id_idx" ON "subjects"("department_id");
CREATE INDEX "routines_class_id_idx" ON "routines"("class_id");
CREATE INDEX "routines_teacher_id_idx" ON "routines"("teacher_id");
CREATE INDEX "routines_academic_year_id_idx" ON "routines"("academic_year_id");
CREATE INDEX "staff_designation_id_idx" ON "staff"("designation_id");
CREATE INDEX "staff_department_id_idx" ON "staff"("department_id");
CREATE INDEX "teacher_class_assignments_class_id_idx" ON "teacher_class_assignments"("class_id");
CREATE INDEX "teacher_class_assignments_academic_year_id_idx" ON "teacher_class_assignments"("academic_year_id");
CREATE INDEX "students_current_class_id_idx" ON "students"("current_class_id");
CREATE INDEX "students_current_section_id_idx" ON "students"("current_section_id");
CREATE INDEX "students_department_id_idx" ON "students"("department_id");
CREATE INDEX "students_academic_year_id_idx" ON "students"("academic_year_id");
CREATE INDEX "students_hifz_teacher_id_idx" ON "students"("hifz_teacher_id");
CREATE INDEX "student_guardians_guardian_id_idx" ON "student_guardians"("guardian_id");
CREATE INDEX "enrollments_class_id_idx" ON "enrollments"("class_id");
CREATE INDEX "student_documents_student_id_idx" ON "student_documents"("student_id");
CREATE INDEX "profile_update_requests_student_id_idx" ON "profile_update_requests"("student_id");
CREATE INDEX "admission_applications_status_idx" ON "admission_applications"("status");
CREATE INDEX "admission_applications_applying_for_class_id_idx" ON "admission_applications"("applying_for_class_id");
CREATE INDEX "admission_applications_applying_for_department_id_idx" ON "admission_applications"("applying_for_department_id");
CREATE INDEX "student_attendance_class_id_attendance_date_idx" ON "student_attendance"("class_id", "attendance_date");
CREATE INDEX "student_attendance_academic_year_id_idx" ON "student_attendance"("academic_year_id");
CREATE INDEX "assignment_submissions_student_id_idx" ON "assignment_submissions"("student_id");
CREATE INDEX "quiz_submissions_student_id_idx" ON "quiz_submissions"("student_id");
CREATE INDEX "exam_marks_student_id_idx" ON "exam_marks"("student_id");
CREATE INDEX "results_student_id_idx" ON "results"("student_id");
CREATE INDEX "hifz_enrollments_assigned_teacher_id_idx" ON "hifz_enrollments"("assigned_teacher_id");
CREATE INDEX "hifz_daily_evaluations_teacher_id_idx" ON "hifz_daily_evaluations"("teacher_id");
CREATE INDEX "hifz_exams_hifz_enrollment_id_idx" ON "hifz_exams"("hifz_enrollment_id");
CREATE INDEX "student_fee_invoices_student_id_idx" ON "student_fee_invoices"("student_id");
CREATE INDEX "student_fee_invoices_academic_year_id_idx" ON "student_fee_invoices"("academic_year_id");
CREATE INDEX "fee_discounts_invoice_id_idx" ON "fee_discounts"("invoice_id");
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");
CREATE INDEX "expenses_expense_category_id_idx" ON "expenses"("expense_category_id");
CREATE INDEX "leave_applications_student_id_idx" ON "leave_applications"("student_id");
CREATE INDEX "leave_applications_staff_id_idx" ON "leave_applications"("staff_id");
CREATE INDEX "service_requests_student_id_idx" ON "service_requests"("student_id");
CREATE INDEX "certificates_student_id_idx" ON "certificates"("student_id");
CREATE INDEX "notices_class_id_idx" ON "notices"("class_id");
CREATE INDEX "notices_department_id_idx" ON "notices"("department_id");
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- ============================================================================
-- FOREIGN KEYS
-- (Only for fields with an explicit @relation in schema.prisma — several
-- similarly-named columns are intentionally plain, unconstrained columns in
-- the current schema; see the migration-verification report.)
-- ============================================================================

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "classes" ADD CONSTRAINT "classes_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sections" ADD CONSTRAINT "sections_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "routines" ADD CONSTRAINT "routines_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "routines" ADD CONSTRAINT "routines_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "routines" ADD CONSTRAINT "routines_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "routines" ADD CONSTRAINT "routines_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "routines" ADD CONSTRAINT "routines_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff" ADD CONSTRAINT "staff_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "staff" ADD CONSTRAINT "staff_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teacher_class_assignments" ADD CONSTRAINT "teacher_class_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_class_assignments" ADD CONSTRAINT "teacher_class_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "teacher_class_assignments" ADD CONSTRAINT "teacher_class_assignments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "teacher_class_assignments" ADD CONSTRAINT "teacher_class_assignments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "teacher_class_assignments" ADD CONSTRAINT "teacher_class_assignments_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "guardians" ADD CONSTRAINT "guardians_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "students" ADD CONSTRAINT "students_current_class_id_fkey" FOREIGN KEY ("current_class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "students" ADD CONSTRAINT "students_current_section_id_fkey" FOREIGN KEY ("current_section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "students" ADD CONSTRAINT "students_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "students" ADD CONSTRAINT "students_hifz_teacher_id_fkey" FOREIGN KEY ("hifz_teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- NOTE: students.academic_year_id has no @relation in schema.prisma (no
-- matching relation field on Student or back-relation on AcademicYear) —
-- intentionally left as a plain, unconstrained column. See report.

ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- NOTE: enrollments.class_id / section_id have no @relation in schema.prisma
-- despite the @@index([classId]) — intentionally plain columns. See report.

ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_update_requests" ADD CONSTRAINT "profile_update_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_resulting_student_id_fkey" FOREIGN KEY ("resulting_student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_applying_for_class_id_fkey" FOREIGN KEY ("applying_for_class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_applying_for_department_id_fkey" FOREIGN KEY ("applying_for_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- NOTE: assignments.class_id / section_id / subject_id / teacher_id and
-- quizzes.class_id / section_id / subject_id / teacher_id have no
-- @relation in schema.prisma — intentionally plain columns. See report.
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NOTE: exams.department_id has no @relation in schema.prisma — intentionally
-- plain column. See report.
ALTER TABLE "exams" ADD CONSTRAINT "exams_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- NOTE: exam_schedules.class_id / subject_id have no @relation. See report.
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_exam_schedule_id_fkey" FOREIGN KEY ("exam_schedule_id") REFERENCES "exam_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "results" ADD CONSTRAINT "results_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "results" ADD CONSTRAINT "results_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NOTE: hifz_enrollments.current_para_id / current_surah_id,
-- hifz_daily_evaluations.sabak_para_id / sabak_surah_id, and
-- hifz_para_completions.para_id have no @relation to quran_paras in
-- schema.prisma, even though quran_paras exists as a lookup table —
-- intentionally plain columns in the current schema. See report.
ALTER TABLE "hifz_enrollments" ADD CONSTRAINT "hifz_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hifz_enrollments" ADD CONSTRAINT "hifz_enrollments_assigned_teacher_id_fkey" FOREIGN KEY ("assigned_teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hifz_daily_evaluations" ADD CONSTRAINT "hifz_daily_evaluations_hifz_enrollment_id_fkey" FOREIGN KEY ("hifz_enrollment_id") REFERENCES "hifz_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hifz_daily_evaluations" ADD CONSTRAINT "hifz_daily_evaluations_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hifz_para_completions" ADD CONSTRAINT "hifz_para_completions_hifz_enrollment_id_fkey" FOREIGN KEY ("hifz_enrollment_id") REFERENCES "hifz_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hifz_exams" ADD CONSTRAINT "hifz_exams_hifz_enrollment_id_fkey" FOREIGN KEY ("hifz_enrollment_id") REFERENCES "hifz_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hifz_certificates" ADD CONSTRAINT "hifz_certificates_hifz_enrollment_id_fkey" FOREIGN KEY ("hifz_enrollment_id") REFERENCES "hifz_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NOTE: student_fee_invoices.academic_year_id has no @relation. See report.
ALTER TABLE "student_fee_invoices" ADD CONSTRAINT "student_fee_invoices_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_fee_invoices" ADD CONSTRAINT "student_fee_invoices_fee_category_id_fkey" FOREIGN KEY ("fee_category_id") REFERENCES "fee_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_discounts" ADD CONSTRAINT "fee_discounts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "student_fee_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "student_fee_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_expense_category_id_fkey" FOREIGN KEY ("expense_category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- NOTE: certificates.related_exam_id has no @relation in schema.prisma
-- (unlike database_schema_reference.sql, which does FK it to exams). See
-- report. Intentionally plain column here, matching the current schema.
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notices" ADD CONSTRAINT "notices_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notices" ADD CONSTRAINT "notices_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- NOTE: approval_requests, failed_login_attempts, and files have no
-- @relation fields at all in schema.prisma — no foreign keys for these
-- tables, matching the schema as written.
