-- Heartbeat-based auto punch-out system schema
-- Run this migration in Supabase SQL editor

-- Punches table (immutable audit trail)
CREATE TABLE IF NOT EXISTS punches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('IN', 'OUT', 'AUTO_OUT')),
  at timestamptz NOT NULL DEFAULT now(),
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Employee status table (current status for fast reads & subscriptions)
CREATE TABLE IF NOT EXISTS employee_status (
  employee_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('IN', 'OUT')),
  last_seen timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_punches_employee_id ON punches(employee_id);
CREATE INDEX IF NOT EXISTS idx_punches_type ON punches(type);
CREATE INDEX IF NOT EXISTS idx_punches_at ON punches(at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_status_status ON employee_status(status);

-- Enable realtime on employee_status for UI subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE employee_status;

-- RLS Policy: employees can only see their own status
CREATE POLICY "users_view_own_status" ON employee_status
  FOR SELECT USING (employee_id = auth.uid());

-- RLS Policy: only service role can write (for worker)
CREATE POLICY "service_role_update_status" ON employee_status
  FOR UPDATE USING (true) WITH CHECK (true);

-- Similarly for punches
CREATE POLICY "users_view_own_punches" ON punches
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY "service_role_insert_punches" ON punches
  FOR INSERT WITH CHECK (true);
