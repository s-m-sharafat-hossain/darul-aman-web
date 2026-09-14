-- Performance indexes added during the P1 backend audit (2026-08-24).
-- All statements are purely additive (CREATE INDEX) — no columns, tables,
-- or constraints are altered or dropped, so this is safe to run against
-- production data without downtime or data loss.
--
-- CONCURRENTLY is deliberately NOT used here: Prisma migrations run inside
-- a transaction by default and CREATE INDEX CONCURRENTLY cannot run inside
-- one. These tables are all small-to-moderate in this deployment; if any
-- has grown large enough that a brief write-lock during index creation is
-- a concern, run the equivalent CONCURRENTLY statements manually outside
-- a transaction instead of `prisma migrate deploy` for this migration.

-- admission_applications: list endpoint sorts by submitted_at with pagination
CREATE INDEX "admission_applications_submitted_at_idx" ON "admission_applications"("submitted_at");

-- leave_applications: staff list endpoint filters by status, sorts by created_at
CREATE INDEX "leave_applications_status_created_at_idx" ON "leave_applications"("status", "created_at");

-- service_requests: staff list endpoint filters by status/request_type, sorts by created_at
CREATE INDEX "service_requests_status_created_at_idx" ON "service_requests"("status", "created_at");
CREATE INDEX "service_requests_request_type_idx" ON "service_requests"("request_type");

-- notices: this exact filter+sort runs on every dashboard load, across every role
CREATE INDEX "notices_is_published_audience_published_at_idx" ON "notices"("is_published", "audience", "published_at");

-- payments: finance summary aggregates payments over a date range
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");

-- expenses: finance summary aggregates expenses over a date range
CREATE INDEX "expenses_expense_date_idx" ON "expenses"("expense_date");

-- failed_login_attempts: now actually populated (see auth.service.js fix in
-- the same batch) — this table is queried on every single login attempt.
CREATE INDEX "failed_login_attempts_identifier_attempted_at_idx" ON "failed_login_attempts"("identifier", "attempted_at");
