# Anonymous usage statistics

FNP Quest records a small set of aggregate events so the project owner can understand whether the app is being used and which lessons are useful. This feature is separate from account progress synchronization.

## Data design

The browser sends only:

- event name
- lesson number when the event belongs to one lesson
- app version
- a random browser identifier to measure return visits in that browser
- a random session identifier, renewed after 30 minutes of inactivity or when the tab session ends
- a broad source category: Facebook, Instagram, Google, LinkedIn, direct, or other
- a random visitor-day identifier that automatically changes each local calendar day
- server-generated event time

It does not send an account ID, email address, XP, streak, study dates, quiz score, selected answer, mistake text, URLs, referrer URLs, or other free-form data. The browser identifier is local to that browser; clearing site data or turning statistics off creates a new identifier. It is a browser estimate, not a count of real people. A separate Supabase client sends these events without the signed-in learning account session.

Events are disabled outside `fnpquest.github.io`, when Global Privacy Control or Do Not Track is enabled, or when the visitor turns them off on the Privacy page.

## Required Supabase setup

Apply the migrations in this order in the Supabase SQL Editor or CLI before deploying the matching web release:

1. `supabase/migrations/202608280001_anonymous_usage_analytics.sql`
2. `supabase/migrations/202608280002_add_lesson_quiz_start_analytics.sql`
3. `supabase/migrations/202608290001_anonymous_analytics_v2.sql`
4. `supabase/migrations/202608300001_create_analytics_daily_summary_view.sql`

Browser roles receive insert-only access; they cannot read, update, or delete analytics rows. V2 also adds a lightweight 30-events-per-minute-per-browser guardrail for accidental loops. It is not an identity or abuse-prevention system.

## Daily Summary view

After applying the Daily Summary migration, open **Database → Views** in Supabase and select `analytics_daily_summary`. It automatically groups events by Pacific Time day and adds these practical metrics:

- `returning_browsers`: browsers that visited on an earlier date and returned today
- `new_browsers`: browsers whose first recorded visit is today
- `sessions` and `study_sessions`: total visits and visits containing a lesson open
- `learners` and `returning_learners`: browsers that opened a lesson, including prior learners who returned
- lesson opens, quiz starts, quiz completions, and mixed/advanced-practice completions
- Facebook, Google, Instagram, LinkedIn, direct, and other-source browser counts

These are anonymous browser estimates, not a count of uniquely identified people. A person using two devices or clearing browser data can appear more than once.

To see the newest day first in the SQL Editor:

```sql
select *
from public.analytics_daily_summary
order by day desc;
```

## Dashboard queries

Run these only in the trusted Supabase SQL Editor.

Daily unique browsers:

```sql
select
  occurred_at::date as day,
  count(distinct visitor_id) as unique_browsers
from public.anonymous_analytics_events
where event_name = 'page_view'
  and visitor_id is not null
group by 1
order by 1 desc;
```

Today’s learning funnel:

```sql
with prior_browsers as (
  select distinct visitor_id
  from public.anonymous_analytics_events
  where occurred_at::date < current_date
    and visitor_id is not null
)
select
  count(distinct visitor_id) filter (where event_name = 'page_view') as visitors,
  count(distinct visitor_id) filter (where event_name = 'lesson_open') as learners,
  count(*) filter (where event_name in ('lesson_quiz_complete', 'practice_complete', 'advanced_practice_complete')) as completed_activities,
  count(distinct visitor_id) filter (where event_name = 'page_view' and visitor_id in (select visitor_id from prior_browsers)) as returning_browsers
from public.anonymous_analytics_events
where occurred_at::date = current_date
  and visitor_id is not null;
```

Sessions and acquisition sources during the last 30 days:

```sql
select
  source,
  count(distinct visitor_id) as unique_browsers,
  count(distinct session_id) as sessions,
  count(*) filter (where event_name = 'lesson_open') as lesson_opens,
  count(*) filter (where event_name in ('lesson_quiz_complete', 'practice_complete', 'advanced_practice_complete')) as completed_activities
from public.anonymous_analytics_events
where occurred_at >= now() - interval '30 days'
  and visitor_id is not null
group by source
order by unique_browsers desc;
```

Lesson opens during the last 30 days:

```sql
select lesson_number, count(*) as opens
from public.anonymous_analytics_events
where event_name = 'lesson_open'
  and occurred_at >= now() - interval '30 days'
group by lesson_number
order by opens desc, lesson_number;
```

Completed activities during the last 30 days:

```sql
select event_name, count(*) as completions
from public.anonymous_analytics_events
where event_name in ('lesson_quiz_complete', 'practice_complete', 'advanced_practice_complete')
  and occurred_at >= now() - interval '30 days'
group by event_name
order by event_name;
```

Lesson quiz starts and completions during the last 30 days:

```sql
select
  lesson_number,
  count(*) filter (where event_name = 'lesson_quiz_start') as starts,
  count(*) filter (where event_name = 'lesson_quiz_complete') as completions
from public.anonymous_analytics_events
where event_name in ('lesson_quiz_start', 'lesson_quiz_complete')
  and occurred_at >= now() - interval '30 days'
group by lesson_number
order by lesson_number;
```

Day-1 and Day-7 return rate for browsers that studied on the relevant prior day:

```sql
with study_days as (
  select distinct visitor_id, occurred_at::date as study_day
  from public.anonymous_analytics_events
  where event_name in ('lesson_open', 'lesson_quiz_complete', 'practice_complete', 'advanced_practice_complete')
    and visitor_id is not null
), eligible as (
  select visitor_id
  from study_days
  where study_day = current_date - 7
)
select
  count(*) as day_7_eligible_browsers,
  count(*) filter (where returned.visitor_id is not null) as day_7_returned_browsers,
  round(100.0 * count(*) filter (where returned.visitor_id is not null) / nullif(count(*), 0), 1) as day_7_return_rate_percent
from eligible
left join study_days returned
  on returned.visitor_id = eligible.visitor_id
 and returned.study_day = current_date;
```

For Day-1 retention, change `current_date - 7` to `current_date - 1` and rename the result columns. This counts returning browsers, not uniquely identified people.

## Retention

Review and remove old aggregate rows on a regular schedule. For a 90-day retention window, run this in the trusted SQL Editor:

```sql
delete from public.anonymous_analytics_events
where occurred_at < now() - interval '90 days';
```
