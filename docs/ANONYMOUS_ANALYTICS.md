# Anonymous usage statistics

FNP Quest records a small set of aggregate events so the project owner can understand whether the app is being used and which lessons are useful. This feature is separate from account progress synchronization.

## Data design

The browser sends only:

- event name
- lesson number when the event belongs to one lesson
- app version
- a random visitor-day identifier that automatically changes each local calendar day
- server-generated event time

It does not send an account ID, email address, XP, streak, study dates, quiz score, selected answer, mistake text, or other free-form data. A separate Supabase client sends these events without the signed-in learning account session.

Events are disabled outside `fnpquest.github.io`, when Global Privacy Control or Do Not Track is enabled, or when the visitor turns them off on the Privacy page.

## Required Supabase setup

Apply `supabase/migrations/202608280001_anonymous_usage_analytics.sql` and then `supabase/migrations/202608280002_add_lesson_quiz_start_analytics.sql` in the Supabase SQL Editor or CLI before deploying the matching web release. Browser roles receive insert-only access; they cannot read, update, or delete analytics rows.

## Dashboard queries

Run these only in the trusted Supabase SQL Editor.

Daily visitors:

```sql
select
  occurred_at::date as day,
  count(distinct visitor_day_id) as visitors
from public.anonymous_analytics_events
where event_name = 'page_view'
group by 1
order by 1 desc;
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

## Retention

Review and remove old aggregate rows on a regular schedule. For a 90-day retention window, run this in the trusted SQL Editor:

```sql
delete from public.anonymous_analytics_events
where occurred_at < now() - interval '90 days';
```
