-- Leave Management Schema and Functions
-- Run in Supabase SQL editor. Creates tables, RLS, and transactional RPCs.

-- Enable required extension for UUIDs
create extension if not exists pgcrypto;

-- Leaves table stores employee leave requests
create table if not exists public.leaves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  category text not null check (category in ('sick','vacation','personal','other')),
  duration text not null check (duration in ('full-day','half-day')),
  reason text,
  document_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  applied_at timestamptz not null default now(),
  decision_at timestamptz,
  admin_id uuid references auth.users(id),
  admin_comment text
);

-- Helpful indexes
create index if not exists leaves_user_id_idx on public.leaves(user_id);
create index if not exists leaves_status_idx on public.leaves(status);
create index if not exists leaves_applied_at_idx on public.leaves(applied_at desc);

-- Audit logs for status changes
create table if not exists public.leave_logs (
  id bigserial primary key,
  leave_id uuid not null references public.leaves(id) on delete cascade,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id),
  from_status text,
  to_status text,
  comment text
);
create index if not exists leave_logs_leave_id_idx on public.leave_logs(leave_id);

-- Row Level Security
alter table public.leaves enable row level security;
alter table public.leave_logs enable row level security;

-- Employees can view and create their own leaves
drop policy if exists "employees_view_own_leaves" on public.leaves;
create policy "employees_view_own_leaves"
  on public.leaves for select
  using (auth.uid() = user_id);

drop policy if exists "employees_create_own_leaves" on public.leaves;
create policy "employees_create_own_leaves"
  on public.leaves for insert
  with check (auth.uid() = user_id);

-- Employees can cancel their own pending leaves
drop policy if exists "employees_cancel_pending" on public.leaves;
create policy "employees_cancel_pending"
  on public.leaves for update
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'cancelled');

-- Admins: read and update any leaves
drop policy if exists "admins_read_all_leaves" on public.leaves;
create policy "admins_read_all_leaves"
  on public.leaves for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists "admins_update_all_leaves" on public.leaves;
create policy "admins_update_all_leaves"
  on public.leaves for update
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- Logs policies: employees/admins can read logs for leaves they can see
drop policy if exists "employees_read_own_logs" on public.leave_logs;
create policy "employees_read_own_logs"
  on public.leave_logs for select
  using (exists (select 1 from public.leaves l where l.id = leave_id and l.user_id = auth.uid()));

drop policy if exists "admins_read_all_logs" on public.leave_logs;
create policy "admins_read_all_logs"
  on public.leave_logs for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- Transactional RPC to approve a leave (with audit log and used_leaves update)
create or replace function public.approve_leave(leave_id_input uuid, comment_input text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_old_status text;
  v_user_id uuid;
  v_from_date date;
  v_to_date date;
  v_duration text;
  v_leave_days integer;
begin
  if not exists (select 1 from public.users u where u.id = v_admin and u.role = 'admin') then
    raise exception 'not allowed: admin only';
  end if;

  select status, user_id, from_date, to_date, duration 
  into v_old_status, v_user_id, v_from_date, v_to_date, v_duration
  from public.leaves where id = leave_id_input for update;
  
  if v_old_status is null then
    raise exception 'leave not found';
  end if;

  -- Calculate leave days as integers (half-day counts as 1)
  v_leave_days := case 
    when v_duration = 'half-day' then 1
    else (v_to_date - v_from_date) + 1
  end;

  update public.leaves
     set status = 'approved',
         decision_at = now(),
         admin_id = v_admin,
         admin_comment = comment_input
   where id = leave_id_input;

  -- Update user's used_leaves count only when transitioning to approved
  if v_old_status <> 'approved' then
    update public.users 
    set used_leaves = coalesce(used_leaves, 0) + v_leave_days
    where id = v_user_id;
  end if;

  insert into public.leave_logs(leave_id, changed_by, from_status, to_status, comment)
  values(leave_id_input, v_admin, v_old_status, 'approved', comment_input);
end;
$$;

-- Transactional RPC to reject a leave (with audit log and used_leaves adjustment)
create or replace function public.reject_leave(leave_id_input uuid, comment_input text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_old_status text;
  v_user_id uuid;
  v_from_date date;
  v_to_date date;
  v_duration text;
  v_leave_days integer;
begin
  if not exists (select 1 from public.users u where u.id = v_admin and u.role = 'admin') then
    raise exception 'not allowed: admin only';
  end if;

  select status, user_id, from_date, to_date, duration 
  into v_old_status, v_user_id, v_from_date, v_to_date, v_duration
  from public.leaves where id = leave_id_input for update;
  
  if v_old_status is null then
    raise exception 'leave not found';
  end if;

  -- Calculate leave days as integers (half-day counts as 1)
  v_leave_days := case 
    when v_duration = 'half-day' then 1
    else (v_to_date - v_from_date) + 1
  end;

  update public.leaves
     set status = 'rejected',
         decision_at = now(),
         admin_id = v_admin,
         admin_comment = comment_input
   where id = leave_id_input;

  -- If the leave was previously approved, decrement the user's used_leaves count
  if v_old_status = 'approved' then
    update public.users 
    set used_leaves = greatest(coalesce(used_leaves, 0) - v_leave_days, 0)
    where id = v_user_id;
  end if;

  insert into public.leave_logs(leave_id, changed_by, from_status, to_status, comment)
  values(leave_id_input, v_admin, v_old_status, 'rejected', comment_input);
end;
$$;

-- Transactional RPC to cancel a leave by the owner (with audit log and used_leaves adjustment)
create or replace function public.cancel_leave(leave_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_old_status text;
  v_user_id uuid;
  v_from_date date;
  v_to_date date;
  v_duration text;
  v_leave_days integer;
begin
  -- Ensure owner and pending
  if not exists (select 1 from public.leaves l where l.id = leave_id_input and l.user_id = v_user and l.status = 'pending') then
    raise exception 'cannot cancel: not owner or not pending';
  end if;

  select status, user_id, from_date, to_date, duration 
  into v_old_status, v_user_id, v_from_date, v_to_date, v_duration
  from public.leaves where id = leave_id_input;

  -- Calculate leave days as integers (half-day counts as 1)
  v_leave_days := case 
    when v_duration = 'half-day' then 1
    else (v_to_date - v_from_date) + 1
  end;

  update public.leaves set status = 'cancelled' where id = leave_id_input;

  -- If the leave was previously approved, decrement the user's used_leaves count
  if v_old_status = 'approved' then
    update public.users 
    set used_leaves = greatest(coalesce(used_leaves, 0) - v_leave_days, 0)
    where id = v_user_id;
  end if;

  insert into public.leave_logs(leave_id, changed_by, from_status, to_status, comment)
  values(leave_id_input, v_user, v_old_status, 'cancelled', 'user cancelled');
end;
$$;

-- Optional: create storage bucket for documents (noop if exists)
insert into storage.buckets (id, name, public)
select 'leave_docs', 'leave_docs', false
where not exists (select 1 from storage.buckets where id = 'leave_docs');