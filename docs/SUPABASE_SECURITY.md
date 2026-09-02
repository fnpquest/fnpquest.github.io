# Supabase security checklist

FNP Quest uses a browser-safe publishable key. Database grants and Row Level Security remain the authorization boundary.

Before public account creation and anonymous analytics deployment:

1. Apply `supabase/migrations/202608250001_harden_learning_data_rls.sql`, `supabase/migrations/202608280001_anonymous_usage_analytics.sql`, `supabase/migrations/202608280002_add_lesson_quiz_start_analytics.sql`, `supabase/migrations/202608290001_anonymous_analytics_v2.sql`, `supabase/migrations/202608300001_create_analytics_daily_summary_view.sql`, and `supabase/migrations/202608310001_create_anonymous_analytics_events_la_view.sql` in a trusted Supabase admin environment.
2. Confirm `anon` cannot select, insert, update, or delete from `profiles`, `daily_activity`, or `quiz_results`.
3. With two dedicated test users, confirm each authenticated user can access only their own rows.
4. Confirm `profiles` supports select/insert/update, `daily_activity` supports select/insert/update, and `quiz_results` supports select/insert for the owning user.
5. Confirm neither browser source nor repository contains a service-role key, secret key, database password, or other privileged credential.
6. Review Supabase Security Advisor findings before every public release.
7. Confirm `anon` and `authenticated` can insert constrained rows into `anonymous_analytics_events`, but cannot select, update, or delete them.
8. Confirm anonymous analytics rows contain no account ID, email, XP, streak, quiz score, selected answer, raw referrer URL, or free-form metadata; browser roles must be unable to read, update, or delete rows.
9. Confirm `anonymous_analytics_events_la` is readable only from a trusted owner/admin session. It is a regular view that reads current rows on each query; do not grant browser roles select access merely to create a live dashboard.

Do not grant client-side delete access merely to implement account deletion. Deleting Auth users and all associated data must run from a trusted administrative environment as described in `docs/ACCOUNT_DELETION.md`.
