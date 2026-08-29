-- Anonymous Analytics V2: return visits, sessions, and broad acquisition source.
-- Apply only after the two 20260828 anonymous-analytics migrations.
-- No account, email, answer, score, XP, streak, or free-form data is added.

begin;

alter table public.anonymous_analytics_events
  add column visitor_id uuid,
  add column session_id uuid,
  add column source text;

alter table public.anonymous_analytics_events
  add constraint anonymous_analytics_events_source_check
  check (source is null or source in ('facebook','instagram','google','linkedin','direct','other'));

create index anonymous_analytics_events_visitor_event_idx
on public.anonymous_analytics_events (visitor_id, event_name, occurred_at desc)
where visitor_id is not null;

create index anonymous_analytics_events_session_idx
on public.anonymous_analytics_events (session_id, occurred_at desc)
where session_id is not null;

comment on table public.anonymous_analytics_events is
'Aggregate FNP Quest usage events. Contains no account ID, email, score, answer, XP, streak, or free-form metadata. Visitor and session IDs are random browser identifiers used only for aggregate returning-visitor and session counts.';

drop policy if exists "Visitors can submit constrained anonymous analytics"
on public.anonymous_analytics_events;

create policy "Visitors can submit constrained anonymous analytics"
on public.anonymous_analytics_events for insert
to anon, authenticated
with check (
  event_name in (
    'page_view',
    'lesson_open',
    'lesson_quiz_start',
    'lesson_quiz_complete',
    'practice_complete',
    'advanced_practice_complete'
  )
  and visitor_id is not null
  and visitor_day_id is not null
  and session_id is not null
  and source in ('facebook','instagram','google','linkedin','direct','other')
  and occurred_at between now() - interval '5 minutes' and now() + interval '5 minutes'
);

-- This is a light guardrail against accidental loops. It is not an identity system
-- and cannot turn browser-submitted analytics into a trusted security boundary.
create or replace function public.limit_anonymous_analytics_event_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*)
    from public.anonymous_analytics_events
    where visitor_id = new.visitor_id
      and occurred_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception 'Anonymous analytics event rate limit reached';
  end if;
  return new;
end;
$$;

revoke all on function public.limit_anonymous_analytics_event_rate() from public, anon, authenticated;

drop trigger if exists anonymous_analytics_events_rate_limit on public.anonymous_analytics_events;
create trigger anonymous_analytics_events_rate_limit
before insert on public.anonymous_analytics_events
for each row execute function public.limit_anonymous_analytics_event_rate();

commit;
