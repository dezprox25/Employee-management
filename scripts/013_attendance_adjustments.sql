-- Attendance adjustments audit log
CREATE TABLE IF NOT EXISTS public.attendance_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  original_login_time TIMESTAMP,
  original_logout_time TIMESTAMP,
  original_total_hours FLOAT,
  new_logout_time TIMESTAMP NOT NULL,
  new_total_hours FLOAT NOT NULL,
  reason TEXT,
  adjusted_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.attendance_adjustments ENABLE ROW LEVEL SECURITY;

-- Allow users/admins to read adjustments; inserts performed by service role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_adjustments' AND policyname = 'attendance_adjustments_select_own'
  ) THEN
    CREATE POLICY "attendance_adjustments_select_own"
      ON public.attendance_adjustments FOR SELECT
      TO authenticated
      USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;