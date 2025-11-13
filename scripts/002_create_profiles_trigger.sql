-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role, type, work_time_start, work_time_end, total_leaves)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'employee'),
    COALESCE(NEW.raw_user_meta_data ->> 'type', 'fulltime'),
    COALESCE((NEW.raw_user_meta_data ->> 'work_time_start')::TIME, '10:00:00'),
    COALESCE((NEW.raw_user_meta_data ->> 'work_time_end')::TIME, '18:00:00'),
    CASE COALESCE(NEW.raw_user_meta_data ->> 'type', 'fulltime')
      WHEN 'fulltime' THEN 12
      WHEN 'intern1' THEN 6
      WHEN 'intern2' THEN 6
      ELSE 12
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
