-- FNP Quest browser clients must only access the signed-in user's own rows.
-- Apply through the Supabase CLI or SQL editor in a trusted admin session.

begin;

alter table public.profiles enable row level security;
alter table public.daily_activity enable row level security;
alter table public.quiz_results enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.daily_activity from anon, authenticated;
revoke all on table public.quiz_results from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.daily_activity to authenticated;
grant select, insert on table public.quiz_results to authenticated;

-- Replace every existing policy on these app tables so an older permissive
-- policy cannot silently survive this hardening migration.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'daily_activity', 'quiz_results')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  end loop;
end
$$;

create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can create their own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can read their own daily activity"
on public.daily_activity for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own daily activity"
on public.daily_activity for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own daily activity"
on public.daily_activity for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can read their own quiz results"
on public.quiz_results for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own quiz results"
on public.quiz_results for insert
to authenticated
with check ((select auth.uid()) = user_id);

commit;
