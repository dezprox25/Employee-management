-- Feedback table and policies
-- Run this in Supabase SQL editor

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_status') THEN
    CREATE TYPE feedback_status AS ENUM ('pending', 'reviewed', 'resolved');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.feedback (
  feedback_id BIGSERIAL PRIMARY KEY,
  user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  feedback_text TEXT NOT NULL,
  submission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status feedback_status NOT NULL DEFAULT 'pending',
  contact_email VARCHAR(320) NULL,
  contact_email_enc TEXT NULL,
  attachment_path TEXT NULL,
  CONSTRAINT feedback_email_valid CHECK (
    contact_email IS NULL OR contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS feedback_user_idx ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS feedback_date_idx ON public.feedback(submission_date DESC);
CREATE INDEX IF NOT EXISTS feedback_status_idx ON public.feedback(status);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'feedback' AND policyname = 'feedback_insert_own'
  ) THEN
    CREATE POLICY "feedback_insert_own"
      ON public.feedback FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'feedback' AND policyname = 'feedback_select_own_or_admin'
  ) THEN
    CREATE POLICY "feedback_select_own_or_admin"
      ON public.feedback FOR SELECT TO authenticated
      USING (
        user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'feedback' AND policyname = 'feedback_update_status_admin'
  ) THEN
    CREATE POLICY "feedback_update_status_admin"
      ON public.feedback FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
  END IF;
END $$;

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
SELECT 'feedback_attachments', 'feedback_attachments', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'feedback_attachments');

-- Enable realtime on feedback table
ALTER PUBLICATION supabase_realtime ADD TABLE feedback;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Ensure encrypted email column exists for existing deployments
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS contact_email_enc TEXT NULL;
