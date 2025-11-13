-- Add plaintext password storage for admin visibility (use with caution)
-- Run this in the Supabase SQL editor to apply.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password TEXT;

-- No policy changes required: existing admin-select policies apply.
-- Consider restricting exposure of this field in any public endpoints.

-- Reload PostgREST schema cache so the column is visible immediately
-- NOTIFY pgrst, 'reload schema';