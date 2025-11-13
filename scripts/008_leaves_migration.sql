-- Migration: align existing public.leaves schema with app expectations
-- Run this in the Supabase SQL editor. It adds missing columns and adjusts constraints
-- without dropping the table or data created by earlier scripts (001_create_tables.sql).

-- 1) Add missing columns if they don't exist
ALTER TABLE public.leaves
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS duration TEXT,
  ADD COLUMN IF NOT EXISTS document_url TEXT,
  ADD COLUMN IF NOT EXISTS decision_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS admin_comment TEXT;

-- 2) Backfill new columns from existing data where possible
-- Map legacy leave_type -> duration
UPDATE public.leaves
SET duration = leave_type
WHERE duration IS NULL AND leave_type IS NOT NULL;

-- 3) Add constraints to new columns (NULLs are allowed for existing rows)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leaves_category_check'
  ) THEN
    ALTER TABLE public.leaves
    ADD CONSTRAINT leaves_category_check
    CHECK (category IN ('sick','vacation','personal','other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leaves_duration_check'
  ) THEN
    ALTER TABLE public.leaves
    ADD CONSTRAINT leaves_duration_check
    CHECK (duration IN ('full-day','half-day'));
  END IF;
END $$;

-- 4) Expand status enum to include 'cancelled' used by cancel RPC
ALTER TABLE public.leaves DROP CONSTRAINT IF EXISTS leaves_status_check;
ALTER TABLE public.leaves ADD CONSTRAINT leaves_status_check
  CHECK (status IN ('pending','approved','rejected','cancelled'));

-- 5) Ensure audit table exists (used by approve/reject/cancel RPCs)
CREATE TABLE IF NOT EXISTS public.leave_logs (
  id BIGSERIAL PRIMARY KEY,
  leave_id UUID NOT NULL REFERENCES public.leaves(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by UUID REFERENCES public.users(id),
  from_status TEXT,
  to_status TEXT,
  comment TEXT
);
CREATE INDEX IF NOT EXISTS leave_logs_leave_id_idx ON public.leave_logs(leave_id);

-- 6) Enable RLS on logs if not already
ALTER TABLE public.leave_logs ENABLE ROW LEVEL SECURITY;

-- 7) Optional: create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
SELECT 'leave_docs', 'leave_docs', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'leave_docs');

-- 8) Reload PostgREST schema cache so new columns are visible to the API
NOTIFY pgrst, 'reload schema';