# FNP Quest account-deletion operations

Signed-in users can request account deletion from the Account page. The app records the request timestamp in the authenticated user's private Supabase Auth metadata under:

`fnp_quest_account_deletion_requested_at`

This is a request queue, not automatic deletion. The app owner must regularly review requests in the Supabase Auth dashboard, delete the user's application rows and Auth account, and document completion. Never expose a service-role or secret key in the browser.

Before public sign-ups are enabled, confirm an operational review schedule and test the full workflow with a dedicated test account:

1. Submit the request from FNP Quest.
2. Confirm the metadata timestamp appears only on that Auth user.
3. Delete the user's `quiz_results`, `daily_activity`, and `profiles` rows.
4. Delete the Auth user through a trusted administrative environment.
5. Confirm the deleted credentials can no longer sign in.

General feedback uses the public GitHub Issues tracker. Users are explicitly told not to put personal, patient, or clinical-record information there.
