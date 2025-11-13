-- Fix RLS policies to avoid infinite recursion on public.users (42P17)
-- Run this in Supabase SQL editor.

-- 1) Helper: determine admin status from auth.users metadata (no recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT COALESCE((
    SELECT (raw_user_meta_data ->> 'role') = 'admin'
    FROM auth.users
    WHERE id = auth.uid()
  ), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = auth, public;

-- 2) Users table policies (drop recursive ones and recreate using is_admin())
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_admin" ON public.users;

CREATE POLICY "users_select_self_or_admin" ON public.users
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "users_update_self_or_admin" ON public.users
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "users_insert_admin_only" ON public.users
  FOR INSERT WITH CHECK (public.is_admin());

-- 3) Attendance policies: replace admin subqueries with is_admin()
DROP POLICY IF EXISTS "attendance_select_own" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert_own" ON public.attendance;
DROP POLICY IF EXISTS "attendance_update_own" ON public.attendance;

CREATE POLICY "attendance_select_self_or_admin" ON public.attendance
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "attendance_insert_self" ON public.attendance
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "attendance_update_self" ON public.attendance
  FOR UPDATE USING (user_id = auth.uid());

-- 4) Leaves policies: replace admin subqueries with is_admin()
DROP POLICY IF EXISTS "leaves_select_own" ON public.leaves;
DROP POLICY IF EXISTS "leaves_insert_own" ON public.leaves;
DROP POLICY IF EXISTS "leaves_update_own" ON public.leaves;

CREATE POLICY "leaves_select_self_or_admin" ON public.leaves
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "leaves_insert_self" ON public.leaves
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "leaves_update_self_or_admin" ON public.leaves
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());

-- 5) Notifications policies: replace admin subqueries with is_admin()
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_admin" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;

CREATE POLICY "notifications_select_self" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_admin_only" ON public.notifications
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "notifications_update_self" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- 6) Ensure RLS remains enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 7) Reload PostgREST schema cache after changes
-- NOTIFY pgrst, 'reload schema';