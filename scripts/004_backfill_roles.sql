-- Backfill roles for existing users
-- Run this in Supabase SQL editor (or psql) to set roles
-- Adjust emails below to match your project users.

-- 1) Ensure admin has role=admin in auth metadata and public.users
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'admin', 'type', 'fulltime', 'work_time_start', '09:00:00', 'work_time_end', '17:00:00')
WHERE email = 'admin@gmail.com';

INSERT INTO public.users (id, name, email, role, type, work_time_start, work_time_end, total_leaves, used_leaves)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'name', 'Administrator'),
  u.email,
  'admin',
  COALESCE(u.raw_user_meta_data ->> 'type', 'fulltime'),
  COALESCE((u.raw_user_meta_data ->> 'work_time_start')::TIME, '09:00:00'),
  COALESCE((u.raw_user_meta_data ->> 'work_time_end')::TIME, '17:00:00'),
  12,
  0
FROM auth.users u
WHERE u.email = 'admin@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 2) Ensure employee has role=employee in auth metadata and public.users
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'employee', 'type', 'fulltime', 'work_time_start', '10:00:00', 'work_time_end', '18:00:00')
WHERE email = 'dineshsiva693@gmail.com';

INSERT INTO public.users (id, name, email, role, type, work_time_start, work_time_end, total_leaves, used_leaves)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
  u.email,
  'employee',
  COALESCE(u.raw_user_meta_data ->> 'type', 'fulltime'),
  COALESCE((u.raw_user_meta_data ->> 'work_time_start')::TIME, '10:00:00'),
  COALESCE((u.raw_user_meta_data ->> 'work_time_end')::TIME, '18:00:00'),
  CASE COALESCE(u.raw_user_meta_data ->> 'type', 'fulltime')
    WHEN 'fulltime' THEN 12
    WHEN 'intern1' THEN 6
    WHEN 'intern2' THEN 6
    ELSE 12
  END,
  0
FROM auth.users u
WHERE u.email = 'dineshsiva693@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'employee';

-- Note: You can duplicate the blocks above for other users,
-- changing the email and role as needed.