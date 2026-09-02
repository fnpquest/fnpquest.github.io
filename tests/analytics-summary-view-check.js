/* Run with Node 18+: node tests/analytics-summary-view-check.js */
const assert=require("assert"),fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const migration=fs.readFileSync(path.join(root,"supabase/migrations/202608300001_create_analytics_daily_summary_view.sql"),"utf8");
const liveEventsMigration=fs.readFileSync(path.join(root,"supabase/migrations/202608310001_create_anonymous_analytics_events_la_view.sql"),"utf8");
const docs=fs.readFileSync(path.join(root,"docs/ANONYMOUS_ANALYTICS.md"),"utf8");

assert.ok(migration.includes("create or replace view public.analytics_daily_summary"),"Daily Summary view is missing.");
for(const column of ["returning_browsers","new_browsers","sessions","study_sessions","learners","returning_learners","lesson_quiz_completions","facebook_browsers","direct_browsers"]){
 assert.ok(migration.includes(column),`Daily Summary is missing ${column}.`);
}
assert.ok(migration.includes("America/Los_Angeles"),"Daily Summary must use the project’s Pacific Time reporting day.");
assert.ok(migration.includes("revoke all on table public.analytics_daily_summary from anon, authenticated"),"Browser roles must not read the owner-only Daily Summary view.");
assert.ok(docs.includes("analytics_daily_summary"),"Analytics documentation must explain the Daily Summary view.");
assert.ok(liveEventsMigration.includes("create or replace view public.anonymous_analytics_events_la"),"The live Los Angeles analytics event view is missing.");
assert.ok(liveEventsMigration.includes("from public.anonymous_analytics_events"),"The live Los Angeles view must read the canonical event table.");
assert.ok(liveEventsMigration.includes("America/Los_Angeles"),"The live event view must expose Pacific Time display columns.");
for(const column of ["occurred_at_los_angeles","event_day_los_angeles","source","visitor_id","session_id"]){
 assert.ok(liveEventsMigration.includes(column),`The live event view is missing ${column}.`);
}
assert.ok(liveEventsMigration.includes("security_invoker = true"),"The live event view must preserve invoker permissions.");
assert.ok(liveEventsMigration.includes("revoke all on table public.anonymous_analytics_events_la from anon, authenticated"),"Browser roles must not read the owner-only live event view.");
assert.ok(!/materialized\s+view/i.test(liveEventsMigration),"The live analytics view must not require a materialized-view refresh.");
assert.ok(docs.includes("anonymous_analytics_events_la"),"Analytics documentation must explain the live Los Angeles event view.");
console.log("Analytics view checks passed: daily summaries, live Los Angeles events, Pacific Time grouping, and private access.");
