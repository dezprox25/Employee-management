-- Migrate attendance time fields to TIMESTAMPTZ to preserve exact punch times
-- Assumption: existing naive timestamps were inserted using UTC (toISOString)
-- Conversion: treat stored values as UTC and convert to TIMESTAMPTZ

BEGIN;

-- Convert login/logout/created_at to TIMESTAMPTZ using UTC as the source zone
ALTER TABLE public.attendance
  ALTER COLUMN login_time TYPE TIMESTAMPTZ USING (CASE WHEN login_time IS NULL THEN NULL ELSE login_time AT TIME ZONE 'UTC' END),
  ALTER COLUMN logout_time TYPE TIMESTAMPTZ USING (CASE WHEN logout_time IS NULL THEN NULL ELSE logout_time AT TIME ZONE 'UTC' END),
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING (CASE WHEN created_at IS NULL THEN NULL ELSE created_at AT TIME ZONE 'UTC' END);

COMMENT ON COLUMN public.attendance.login_time IS 'Recorded punch-in time (TIMESTAMPTZ)';
COMMENT ON COLUMN public.attendance.logout_time IS 'Recorded punch-out time (TIMESTAMPTZ)';
COMMENT ON COLUMN public.attendance.created_at IS 'Row creation time (TIMESTAMPTZ)';

COMMIT;

-- Note: Run this script once against your Supabase/Postgres database.
-- After migration, keep inserting times using ISO strings (UTC) like new Date().toISOString().