-- -- Attendance punch events (fine-grained timestamps with timezone)
-- CREATE TABLE IF NOT EXISTS public.attendance_events (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
--   punch_type TEXT NOT NULL CHECK (punch_type IN ('in','out')),
--   ts TIMESTAMPTZ NOT NULL,
--   punched_at_minute TIMESTAMPTZ GENERATED ALWAYS AS (date_trunc('minute', ts)) STORED,
--   status TEXT CHECK (status IN ('present','late','correction')),
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- -- Prevent accidental duplicates: same user, same punch type within the same minute
-- CREATE UNIQUE INDEX IF NOT EXISTS attendance_events_unique_minute
--   ON public.attendance_events (user_id, punch_type, punched_at_minute);

-- CREATE INDEX IF NOT EXISTS attendance_events_user_ts_idx
--   ON public.attendance_events (user_id, ts DESC);

-- -- Audit log for punches
-- CREATE TABLE IF NOT EXISTS public.attendance_audit (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   event_id UUID REFERENCES public.attendance_events(id) ON DELETE SET NULL,
--   user_id UUID NOT NULL,
--   punch_type TEXT NOT NULL CHECK (punch_type IN ('in','out')),
--   ts TIMESTAMPTZ NOT NULL,
--   success BOOLEAN NOT NULL,
--   error_code TEXT,
--   error_message TEXT,
--   correction_applied BOOLEAN DEFAULT FALSE,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- CREATE INDEX IF NOT EXISTS attendance_audit_user_ts_idx
--   ON public.attendance_audit (user_id, created_at DESC);

-- -- RLS policies
-- ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.attendance_audit ENABLE ROW LEVEL SECURITY;

-- -- Allow users to insert and view their own punch events
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_events' AND policyname = 'Attendance events insert own'
--   ) THEN
--     CREATE POLICY "Attendance events insert own"
--       ON public.attendance_events FOR INSERT
--       TO authenticated
--       WITH CHECK (user_id = auth.uid());
--   END IF;

--   IF NOT EXISTS (
--     SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_events' AND policyname = 'Attendance events select own'
--   ) THEN
--     CREATE POLICY "Attendance events select own"
--       ON public.attendance_events FOR SELECT
--       TO authenticated
--       USING (user_id = auth.uid());
--   END IF;

--   -- Audit: allow users to see their own audit rows; inserts are performed by server if desired
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_audit' AND policyname = 'Attendance audit select own'
--   ) THEN
--     CREATE POLICY "Attendance audit select own"
--       ON public.attendance_audit FOR SELECT
--       TO authenticated
--       USING (user_id = auth.uid());
--   END IF;
-- END $$;

-- -- Note: server may write audit rows using service role; no insert policy is required for authenticated here.




-- ========================================
-- ATTENDANCE TRACKING SYSTEM (FIXED VERSION)
-- ========================================

-- Attendance punch events (fine-grained timestamps with timezone)
CREATE TABLE IF NOT EXISTS public.attendance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  punch_type TEXT NOT NULL CHECK (punch_type IN ('in','out')),
  ts TIMESTAMPTZ NOT NULL,
  punched_at_minute TIMESTAMPTZ, -- filled by trigger
  status TEXT CHECK (status IN ('present','late','correction')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ✅ Trigger function to generate punched_at_minute (IMMUTABLE workaround)
CREATE OR REPLACE FUNCTION public.set_punched_at_minute()
RETURNS TRIGGER AS $$
BEGIN
  NEW.punched_at_minute := date_trunc('minute', NEW.ts);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ✅ Trigger to auto-fill punched_at_minute
CREATE TRIGGER trg_set_punched_at_minute
BEFORE INSERT OR UPDATE ON public.attendance_events
FOR EACH ROW
EXECUTE FUNCTION public.set_punched_at_minute();

-- ✅ Prevent accidental duplicates: same user, same punch type, same minute
CREATE UNIQUE INDEX IF NOT EXISTS attendance_events_unique_minute
  ON public.attendance_events (user_id, punch_type, punched_at_minute);

CREATE INDEX IF NOT EXISTS attendance_events_user_ts_idx
  ON public.attendance_events (user_id, ts DESC);

-- ========================================
-- AUDIT LOG TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.attendance_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.attendance_events(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  punch_type TEXT NOT NULL CHECK (punch_type IN ('in','out')),
  ts TIMESTAMPTZ NOT NULL,
  success BOOLEAN NOT NULL,
  error_code TEXT,
  error_message TEXT,
  correction_applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS attendance_audit_user_ts_idx
  ON public.attendance_audit (user_id, created_at DESC);

-- ========================================
-- RLS POLICIES
-- ========================================
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_audit ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Attendance Events: Insert own
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'attendance_events' 
    AND policyname = 'Attendance events insert own'
  ) THEN
    CREATE POLICY "Attendance events insert own"
      ON public.attendance_events FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  -- Attendance Events: Select own
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'attendance_events' 
    AND policyname = 'Attendance events select own'
  ) THEN
    CREATE POLICY "Attendance events select own"
      ON public.attendance_events FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  -- Audit: Select own
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'attendance_audit' 
    AND policyname = 'Attendance audit select own'
  ) THEN
    CREATE POLICY "Attendance audit select own"
      ON public.attendance_audit FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ========================================
-- NOTES
-- ========================================
-- • Trigger ensures punched_at_minute stays accurate without immutability errors.
-- • Uses TIMESTAMPTZ for correct timezone handling.
-- • Unique constraint prevents duplicate punches within the same minute.
-- • RLS policies ensure users only see or insert their own data.
-- • Audit logs can be written by server/service role.
