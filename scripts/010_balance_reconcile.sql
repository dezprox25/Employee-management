-- Daily reconciliation of used leave balances with audit trail
-- Run this in Supabase SQL editor to apply. Requires admins in public.users.

-- Audit table for balance adjustments
create table if not exists public.balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  old_used_leaves integer not null,
  new_used_leaves integer not null,
  reason text not null default 'daily_reconciliation',
  details jsonb,
  created_at timestamptz not null default now()
);

-- Index for faster lookups
create index if not exists balance_adjustments_user_id_idx on public.balance_adjustments(user_id);

-- Security: allow admins to read adjustments
drop policy if exists "admins_read_adjustments" on public.balance_adjustments;
create policy "admins_read_adjustments"
  on public.balance_adjustments for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- Transactional function to reconcile balances; counts approved and optionally pending leaves
create or replace function public.reconcile_leave_balances(include_pending boolean default true, count_other boolean default true)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_updated integer := 0;
  r record;
  v_old integer;
  v_new integer;
begin
  -- Enforce admin
  if not exists (select 1 from public.users u where u.id = v_admin and u.role = 'admin') then
    raise exception 'not allowed: admin only';
  end if;

  for r in select id from public.users where role = 'employee' loop
    -- Sum days for approved + optional pending, include special categories by default
    select coalesce(sum(
      case when duration = 'half-day' then 1 else (to_date - from_date) + 1 end
    ), 0)
    into v_new
    from public.leaves
    where user_id = r.id
      and (
        status = 'approved' or (include_pending and status = 'pending')
      )
      and (
        category in ('sick','vacation','personal') or (count_other and category = 'other')
      )
      and from_date is not null and to_date is not null
      and from_date <= to_date;

    select coalesce(used_leaves, 0) into v_old from public.users where id = r.id for update;

    if v_old <> v_new then
      update public.users set used_leaves = v_new where id = r.id;
      insert into public.balance_adjustments(user_id, old_used_leaves, new_used_leaves, details)
      values(
        r.id,
        v_old,
        v_new,
        jsonb_build_object('include_pending', include_pending, 'count_other', count_other)
      );
      v_updated := v_updated + 1;
    end if;
  end loop;

  return v_updated;
end;
$$;

-- Optional: schedule daily reconciliation at 02:00 using pg_cron (if available)
-- create extension if not exists pg_cron;
-- select cron.schedule('daily_leave_reconcile', '0 2 * * *', $$select public.reconcile_leave_balances(true, true)$$);

-- Reload PostgREST schema
-- NOTIFY pgrst, 'reload schema';