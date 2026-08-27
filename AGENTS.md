# FNP Quest — Codex Project Rules

## Project
FNP Quest is a mobile-first FNP learning web app with:
- Lessons and lesson quizzes
- XP
- Streak and Streak Freeze
- Total Study Days
- Progress tracking
- Dark Mode / Light Mode
- Supabase authentication and cloud synchronization
- Version checking
- GitHub Pages deployment

This is an existing, evolving application. Treat every change as an incremental release.

## 1. Preserve Existing Functionality
Before changing code, inspect the existing implementation and make the smallest safe change.

Never remove or silently change:
- Lesson 1 through Lesson 7
- Existing lesson content
- Existing quiz questions or explanations
- XP
- Streak
- Streak Freeze
- Total Study Days
- Progress
- Dark Mode / Light Mode
- Supabase authentication
- Supabase cloud synchronization
- daily activity tracking
- version checking

A new lesson or feature must not cause an existing lesson or feature to disappear.

## 2. Lessons
When adding a lesson:
1. Follow the existing lesson structure.
2. Preserve all existing lessons in full.
3. Add the lesson to the main curriculum.
4. Make sure the lesson can actually be opened from the UI.
5. Add its quiz and answer explanations.
6. Verify Lessons 1–7 still load.

Never use `null` or an unloaded placeholder for a lesson body.

## 3. Quiz Requirements
Quiz questions, choices, correct answers, explanations, and navigation must work in both themes.

Check:
- question text
- answer choices
- selected state
- correct/incorrect state
- Correct!/Incorrect! message
- correct-answer text
- explanation box
- explanation text
- Next Question
- Back/Home/Lesson buttons

Dark Mode must never use a light background with white/light text.

## 4. Dark Mode
All text and controls must have adequate contrast in Dark Mode:
- Home
- Learn
- Practice
- Progress
- lessons
- quizzes
- explanations
- buttons
- navigation
- forms
- modals/toasts
- version information

Do not fix Dark Mode by breaking Light Mode. Prefer scoped theme CSS.

## 5. XP
Do not reset XP during:
- reload
- login/logout
- version update
- browser refresh
- lesson updates

Do not change XP calculations unless explicitly requested.

## 6. Streak
Streak means consecutive study days.

Test:
1. first study day
2. consecutive days
3. missed day
4. return after a missed day
5. streak freeze
6. reload
7. logout/login
8. cloud synchronization

A reload/login must never incorrectly reduce a completed streak.

## 7. Total Study Days
Total Study Days means the number of unique calendar dates on which the user studied.

Rules:
- Multiple sessions on one date = one study day.
- A new study date increases the count by one.
- Missing a day never decreases the total.
- Breaking a streak never decreases the total.
- Reload/login/version updates never reset it.
- Prefer Supabase `daily_activity` as the cloud source of historical study dates.

Streak and Total Study Days are different metrics.

## 8. Supabase
Preserve existing Supabase behavior.

Never expose:
- service-role keys
- database passwords
- private/secret credentials

Only browser-safe publishable/anon credentials may be used client-side.

Do not change RLS or database schema unless explicitly requested.

Never delete historical study data as part of a UI or bug fix.

## 9. Authentication
Do not silently change:
- sign-in
- sign-up
- sessions
- logout
- redirects
- Supabase auth configuration

## 10. Versioning
Every release must keep the version synchronized in:
- `index.html`
- `version.json`

Example:
- index.html = v13.8
- version.json = v13.8

When asked for a new version:
1. increment the version
2. update the visible version label
3. update `version.json`
4. verify both match

Do not leave stale production version files that could confuse the deployment.

## 11. Version Checking
Preserve the existing version-checking mechanism.

Version updates must not:
- reset XP
- reset Streak
- reset Total Study Days
- delete lessons
- delete user data
- unnecessarily log the user out

## 12. GitHub Pages
The app is deployed as a static GitHub Pages site.

Keep it compatible with static hosting.

Be careful with:
- relative paths
- `fetch()`
- JSON paths
- trailing slashes
- repository/subdirectory deployment

Do not assume the app is hosted at the domain root.

## 13. Mobile First
The primary user is on iPhone.

Every UI change should consider:
- portrait layout
- readable font sizes
- touch-friendly controls
- no horizontal overflow
- safe bottom navigation spacing
- iOS browser/app UI
- quiz choices large enough to tap
- explanations readable without zooming

## 14. Navigation
Preserve:
- Home
- Learn
- Practice
- Progress

Keep the active navigation item distinguishable and readable in both themes.

## 15. Testing
Before declaring a task complete:

### JavaScript
Run syntax checks such as:
`node --check`

### Functional/static checks
Verify:
- app loads
- Home loads
- Learn loads
- Practice loads
- Progress loads
- Lesson 1–7 load
- quizzes load
- explanations display
- Dark Mode works
- Light Mode works
- XP is preserved
- Streak is preserved
- Total Study Days is preserved
- Supabase code is not broken
- version numbers match

If browser/mobile automation is unavailable, say so clearly and do not claim it was tested.

## 16. Regression Protection
Protect against these known classes of bugs:
- Lesson 2 becoming `null`
- Lesson 7 disappearing from the curriculum
- Dark Mode text becoming unreadable
- quiz explanation text becoming invisible
- Streak decreasing after reload
- Total Study Days disappearing/resetting
- `index.html` and `version.json` having different versions

## 17. Code Style
Prefer:
- small safe changes
- reusable helpers
- scoped CSS
- defensive checks
- explicit error handling
- backward compatibility

Avoid unnecessary rewrites.

Do not replace the entire app to fix a small bug.

Do not modify the database for a UI-only problem.

## 18. Medical Content
This is an educational FNP preparation app.

When adding lessons:
- preserve the requested curriculum structure
- preserve terminology and level of detail
- include clinical examples/clinical reasoning when requested
- add a quiz after each lesson when requested
- do not silently replace user-provided curriculum with unrelated material

## 19. New Lesson Checklist
Before finishing a new lesson:
- [ ] Full lesson body added
- [ ] Lesson appears in curriculum
- [ ] Lesson opens correctly
- [ ] Quiz added
- [ ] Correct answers verified
- [ ] Explanations added
- [ ] Dark Mode checked
- [ ] Light Mode checked
- [ ] Navigation works
- [ ] Progress tracking works
- [ ] Lessons 1–7 still work
- [ ] Version updated if requested

## 20. Release Checklist
Before a release:
- [ ] Existing lessons preserved
- [ ] Requested feature implemented
- [ ] Dark Mode checked
- [ ] Light Mode checked
- [ ] Mobile layout checked
- [ ] Quiz checked
- [ ] Explanation checked
- [ ] XP checked
- [ ] Streak checked
- [ ] Total Study Days checked
- [ ] Supabase checked
- [ ] Authentication checked
- [ ] Version updated
- [ ] `version.json` updated
- [ ] JavaScript syntax checked
- [ ] No secrets added
- [ ] No destructive database changes
- [ ] Git diff reviewed

## 21. Communication
When completing a task, report:
1. What changed
2. Files changed
3. Version number
4. Tests performed
5. Anything the user should manually test

Never claim a browser/mobile behavior was tested if it was only statically inspected.

## 22. Default Codex Workflow

For "Fix this bug":
1. Locate/reproduce the issue.
2. Inspect relevant code.
3. Identify the smallest safe fix.
4. Implement it.
5. Run tests.
6. Review the diff.
7. Report the result.

For "Add a new lesson":
1. Inspect the existing lesson architecture.
2. Add the lesson using the existing pattern.
3. Add quiz and explanations.
4. Add it to curriculum/navigation.
5. Test existing lessons.
6. Update version if requested.

For "Make a new version":
1. Preserve existing functionality.
2. Increment the version.
3. Update `index.html`.
4. Update `version.json`.
5. Run syntax/tests.
6. Review the diff.

## 23. Most Important Rule
Preserve what already works.
Fix the requested problem.
Add the requested feature.
Test for regressions.
Never silently remove existing functionality.
