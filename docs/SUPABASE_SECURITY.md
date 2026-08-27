# Supabase security checklist

FNP Quest uses a browser-safe publishable key. Database grants and Row Level Security remain the authorization boundary.

Before public account creation:

1. Apply `supabase/migrations/202608250001_harden_learning_data_rls.sql` in a trusted Supabase admin environment.
2. Confirm `anon` cannot select, insert, update, or delete from `profiles`, `daily_activity`, or `quiz_results`.
3. With two dedicated test users, confirm each authenticated user can access only their own rows.
4. Confirm `profiles` supports select/insert/update, `daily_activity` supports select/insert/update, and `quiz_results` supports select/insert for the owning user.
5. Confirm neither browser source nor repository contains a service-role key, secret key, database password, or other privileged credential.
6. Review Supabase Security Advisor findings before every public release.

Do not grant client-side delete access merely to implement account deletion. Deleting Auth users and all associated data must run from a trusted administrative environment as described in `docs/ACCOUNT_DELETION.md`.
