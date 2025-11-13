-- Create default admin account
-- This script should be run after the database is set up

-- Insert the admin user into auth.users (this will trigger the handle_new_user function)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@gmail.com',
  '$2a$10$r8J3X5L9s2q1w4e7r9t0yu.ABCDEFGHIJKLMNOPQRSTUVWXYZ01234', -- bcrypt hash for 'admin123'
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Administrator", "role": "admin", "type": "fulltime", "work_time_start": "09:00:00", "work_time_end": "17:00:00"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
)
ON CONFLICT (email) DO NOTHING;

-- If the trigger didn't work, manually ensure the public.users record exists
INSERT INTO public.users (
  id,
  name,
  email,
  role,
  type,
  work_time_start,
  work_time_end,
  total_leaves,
  used_leaves
)
SELECT 
  u.id,
  'Administrator',
  u.email,
  'admin',
  'fulltime',
  '09:00:00',
  '17:00:00',
  12,
  0
FROM auth.users u
WHERE u.email = 'admin@gmail.com'
AND NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'admin@gmail.com');