/* Run with Node 18+: node tests/analytics-summary-view-check.js */
const assert=require("assert"),fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const migration=fs.readFileSync(path.join(root,"supabase/migrations/202608300001_create_analytics_daily_summary_view.sql"),"utf8");
const docs=fs.readFileSync(path.join(root,"docs/ANONYMOUS_ANALYTICS.md"),"utf8");

assert.ok(migration.includes("create or replace view public.analytics_daily_summary"),"Daily Summary view is missing.");
for(const column of ["returning_browsers","new_browsers","sessions","study_sessions","learners","returning_learners","lesson_quiz_completions","facebook_browsers","direct_browsers"]){
 assert.ok(migration.includes(column),`Daily Summary is missing ${column}.`);
}
assert.ok(migration.includes("America/Los_Angeles"),"Daily Summary must use the project’s Pacific Time reporting day.");
assert.ok(migration.includes("revoke all on table public.analytics_daily_summary from anon, authenticated"),"Browser roles must not read the owner-only Daily Summary view.");
assert.ok(docs.includes("analytics_daily_summary"),"Analytics documentation must explain the Daily Summary view.");
console.log("Analytics Daily Summary checks passed: return metrics, meaningful activity metrics, Pacific Time grouping, and private access.");
