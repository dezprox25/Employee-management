-- Add position column to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS position TEXT;

-- Optional: include in RLS policies if needed (no change required as SELECT already allowed for employees/admins)

-- Reload PostgREST schema (if running with PostgREST)
-- NOTIFY pgrst, 'reload schema';