-- Owner-only live analytics event view with Pacific Time display columns.
-- A regular view reads public.anonymous_analytics_events on every query, so
-- it does not need a cron job or materialized-view refresh.
-- This migration does not alter, copy, or delete analytics or learning data.

begin;

create or replace view public.anonymous_analytics_events_la
with (security_invoker = true)
as
select
  id,
  occurred_at,
  event_name,
  visitor_day_id,
  lesson_number,
  app_version,
  occurred_at at time zone 'America/Los_Angeles' as occurred_at_los_angeles,
  (occurred_at at time zone 'America/Los_Angeles')::date as event_day_los_angeles,
  source,
  visitor_id,
  session_id
from public.anonymous_analytics_events;

comment on view public.anonymous_analytics_events_la is
'Owner-only live FNP Quest analytics events with Los Angeles display time. This regular view reflects new source rows whenever it is queried; Supabase SQL Editor result panes still require Run or refresh.';

revoke all on table public.anonymous_analytics_events_la from anon, authenticated;

commit;
