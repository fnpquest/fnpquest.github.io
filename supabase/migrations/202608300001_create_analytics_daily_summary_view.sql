-- Owner-only Daily Summary analytics view for FNP Quest.
-- Apply after the anonymous analytics V2 migration.
-- This creates a view only; it does not alter or delete learning or account data.

begin;

create or replace view public.analytics_daily_summary
with (security_invoker = true)
as
with events as (
  select
    (occurred_at at time zone 'America/Los_Angeles')::date as day,
    visitor_id,
    session_id,
    source,
    event_name
  from public.anonymous_analytics_events
), visitor_days as (
  select distinct day, visitor_id
  from events
  where event_name = 'page_view'
    and visitor_id is not null
), visitor_summary as (
  select
    current_day.day,
    count(*) as unique_browsers,
    count(*) filter (
      where exists (
        select 1
        from visitor_days prior_day
        where prior_day.visitor_id = current_day.visitor_id
          and prior_day.day < current_day.day
      )
    ) as returning_browsers,
    count(*) filter (
      where not exists (
        select 1
        from visitor_days prior_day
        where prior_day.visitor_id = current_day.visitor_id
          and prior_day.day < current_day.day
      )
    ) as new_browsers
  from visitor_days current_day
  group by current_day.day
), learner_days as (
  select distinct day, visitor_id
  from events
  where event_name = 'lesson_open'
    and visitor_id is not null
), learner_summary as (
  select
    current_day.day,
    count(*) as learners,
    count(*) filter (
      where exists (
        select 1
        from learner_days prior_day
        where prior_day.visitor_id = current_day.visitor_id
          and prior_day.day < current_day.day
      )
    ) as returning_learners
  from learner_days current_day
  group by current_day.day
), event_summary as (
  select
    day,
    count(*) filter (where event_name = 'page_view') as page_views,
    count(distinct session_id) filter (where session_id is not null) as sessions,
    count(distinct session_id) filter (where event_name = 'lesson_open' and session_id is not null) as study_sessions,
    count(*) filter (where event_name = 'lesson_open') as lesson_opens,
    count(*) filter (where event_name = 'lesson_quiz_start') as lesson_quiz_starts,
    count(*) filter (where event_name = 'lesson_quiz_complete') as lesson_quiz_completions,
    count(*) filter (where event_name = 'practice_complete') as mixed_practice_completions,
    count(*) filter (where event_name = 'advanced_practice_complete') as advanced_practice_completions,
    count(*) filter (where event_name in ('lesson_quiz_complete', 'practice_complete', 'advanced_practice_complete')) as total_activity_completions,
    count(distinct visitor_id) filter (where event_name = 'page_view' and source = 'facebook') as facebook_browsers,
    count(distinct visitor_id) filter (where event_name = 'page_view' and source = 'google') as google_browsers,
    count(distinct visitor_id) filter (where event_name = 'page_view' and source = 'instagram') as instagram_browsers,
    count(distinct visitor_id) filter (where event_name = 'page_view' and source = 'linkedin') as linkedin_browsers,
    count(distinct visitor_id) filter (where event_name = 'page_view' and source = 'direct') as direct_browsers,
    count(distinct visitor_id) filter (where event_name = 'page_view' and source = 'other') as other_source_browsers
  from events
  group by day
)
select
  event_summary.day,
  event_summary.page_views,
  coalesce(visitor_summary.unique_browsers, 0) as unique_browsers,
  coalesce(visitor_summary.returning_browsers, 0) as returning_browsers,
  coalesce(visitor_summary.new_browsers, 0) as new_browsers,
  event_summary.sessions,
  event_summary.study_sessions,
  coalesce(learner_summary.learners, 0) as learners,
  coalesce(learner_summary.returning_learners, 0) as returning_learners,
  event_summary.lesson_opens,
  event_summary.lesson_quiz_starts,
  event_summary.lesson_quiz_completions,
  event_summary.mixed_practice_completions,
  event_summary.advanced_practice_completions,
  event_summary.total_activity_completions,
  event_summary.facebook_browsers,
  event_summary.google_browsers,
  event_summary.instagram_browsers,
  event_summary.linkedin_browsers,
  event_summary.direct_browsers,
  event_summary.other_source_browsers
from event_summary
left join visitor_summary using (day)
left join learner_summary using (day)
order by event_summary.day desc;

comment on view public.analytics_daily_summary is
'Owner-only daily FNP Quest analytics summary in America/Los_Angeles time. Returning browsers and learners are pseudonymous same-browser counts, not verified people.';

revoke all on table public.analytics_daily_summary from anon, authenticated;

commit;
