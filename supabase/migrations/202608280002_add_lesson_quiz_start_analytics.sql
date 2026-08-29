-- Allow FNP Quest to record when a lesson quiz successfully starts.
-- This event contains only the existing visitor-day ID, lesson number, and app version.

begin;

alter table public.anonymous_analytics_events
drop constraint if exists anonymous_analytics_events_event_name_check;

alter table public.anonymous_analytics_events
add constraint anonymous_analytics_events_event_name_check
check (event_name in (
  'page_view',
  'lesson_open',
  'lesson_quiz_start',
  'lesson_quiz_complete',
  'practice_complete',
  'advanced_practice_complete'
));

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
  and occurred_at between now() - interval '5 minutes' and now() + interval '5 minutes'
);

commit;
