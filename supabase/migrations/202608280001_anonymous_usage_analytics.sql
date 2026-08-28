-- Privacy-preserving, aggregate usage events for FNP Quest.
-- Apply through the Supabase CLI or SQL editor in a trusted admin session.

begin;

create table if not exists public.anonymous_analytics_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  event_name text not null check (event_name in (
    'page_view',
    'lesson_open',
    'lesson_quiz_complete',
    'practice_complete',
    'advanced_practice_complete'
  )),
  visitor_day_id uuid not null,
  lesson_number smallint check (lesson_number between 1 and 500),
  app_version text not null check (char_length(app_version) between 1 and 32)
);

comment on table public.anonymous_analytics_events is
'Aggregate FNP Quest usage events. Contains no account ID, email, score, answer, XP, streak, or free-form metadata.';

create index if not exists anonymous_analytics_events_occurred_at_idx
on public.anonymous_analytics_events (occurred_at desc);

create index if not exists anonymous_analytics_events_event_lesson_idx
on public.anonymous_analytics_events (event_name, lesson_number, occurred_at desc);

alter table public.anonymous_analytics_events enable row level security;

revoke all on table public.anonymous_analytics_events from anon, authenticated;
grant insert on table public.anonymous_analytics_events to anon, authenticated;

drop policy if exists "Visitors can submit constrained anonymous analytics" on public.anonymous_analytics_events;
create policy "Visitors can submit constrained anonymous analytics"
on public.anonymous_analytics_events for insert
to anon, authenticated
with check (
  event_name in ('page_view','lesson_open','lesson_quiz_complete','practice_complete','advanced_practice_complete')
  and occurred_at between now() - interval '5 minutes' and now() + interval '5 minutes'
);

commit;
