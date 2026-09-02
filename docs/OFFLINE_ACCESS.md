# Registered-account offline access

FNP Quest requires a registered Supabase email account before the learning interface opens.

## Learner workflow

1. Open FNP Quest while connected to the internet.
2. Create an account or sign in with an existing registered email and password.
3. Leave the app open until the Account page says the offline course files are ready.
4. Install the web app from the browser's Add to Home Screen / Install command when desired.
5. The verified account may use that device offline for up to 30 days.
6. Reconnect within 30 days. FNP Quest reverifies the account and resumes cloud synchronization automatically.

Signing out removes the offline authorization from that browser. It does not delete account data or account-scoped learning progress.

## What is cached

The service worker caches the app shell, curriculum manifest, all lesson files, all lesson quizzes, all available advanced quizzes, icons, and Daily Questions assets. Supabase API and Auth responses are never cached.

## Security boundary

Offline authorization is a time-limited device record stored in browser storage after `supabase.auth.getUser()` verifies the account online. It is appropriate for ordinary learning-app access control, but a static offline web application cannot provide tamper-proof authorization against a user who controls the device and modifies its browser storage or source code.

Strict administrator-approved email access would require a server-managed entitlement or allowlist plus periodic online verification. This implementation treats any successfully registered and authenticated Supabase email account as eligible and does not change the database schema or RLS policies.
