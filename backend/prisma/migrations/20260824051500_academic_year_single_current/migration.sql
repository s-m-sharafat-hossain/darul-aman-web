-- Guarantees at most one academic_years row can have is_current = true,
-- as a database-level backstop to the transactional fix in
-- academic.controller.js's createAcademicYear. The app-level transaction
-- closes the crash/partial-write case; this partial unique index closes
-- the remaining true-concurrency case (two admins creating a new current
-- year at the exact same moment) that a transaction alone can't fully
-- prevent under Postgres's default isolation behavior for non-conflicting
-- writes.
--
-- This is additive and safe to run on existing data UNLESS more than one
-- row currently has is_current = true — in that case this statement will
-- fail with a uniqueness violation. Run this check first:
--   SELECT count(*) FROM academic_years WHERE is_current = true;
-- If it returns more than 1, manually set is_current = false on all but
-- the intended current year before applying this migration.
CREATE UNIQUE INDEX "academic_years_single_current_idx"
  ON "academic_years"("is_current")
  WHERE "is_current" = true;
