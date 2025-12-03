-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
  position TEXT,
  type TEXT NOT NULL CHECK (type IN ('fulltime', 'intern1', 'intern2')),
  work_time_start TIME NOT NULL,
  work_time_end TIME NOT NULL,
  total_leaves INTEGER NOT NULL,
  used_leaves INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
  
-- Create attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  login_time TIMESTAMP,
  logout_time TIMESTAMP,
  location TEXT,
  reason TEXT,
  total_hours FLOAT,
  status TEXT CHECK (status IN ('present', 'absent', 'late', 'half-day')),
  auto_adjusted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create leaves table
CREATE TABLE IF NOT EXISTS public.leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('full-day', 'half-day')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.users(id),
  applied_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users RLS Policies
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "users_insert_admin" ON public.users FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Attendance RLS Policies
CREATE POLICY "attendance_select_own" ON public.attendance FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "attendance_insert_own" ON public.attendance FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "attendance_update_own" ON public.attendance FOR UPDATE USING (user_id = auth.uid());

-- Leaves RLS Policies
CREATE POLICY "leaves_select_own" ON public.leaves FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "leaves_insert_own" ON public.leaves FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "leaves_update_own" ON public.leaves FOR UPDATE USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Notifications RLS Policies
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_insert_admin" ON public.notifications FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_attendance_user_id ON public.attendance(user_id);
CREATE INDEX idx_attendance_date ON public.attendance(date);
CREATE INDEX idx_leaves_user_id ON public.leaves(user_id);
CREATE INDEX idx_leaves_status ON public.leaves(status);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
