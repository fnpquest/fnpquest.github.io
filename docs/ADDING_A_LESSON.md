# Adding a Lesson

FNP Quest uses one canonical curriculum manifest: `data/curriculum.json`. The manifest keeps a flat, ordered `lessons` array for backward-compatible progress tracking and a `courses` array for the Home/Curriculum grouping.

To add Lesson 22 or later, do not edit core application logic.

1. Create `data/lessons/lesson-22.json`:

```json
{"id":22,"title":"Week X · Lesson 22: Title","tag":"PHASE 1 · ADVANCED PATHOPHYSIOLOGY","html":"<h1>...</h1><p>...</p>"}
```

`html` is the lesson body rendered inside the existing lesson card. Keep approved course wording intact and use safe HTML only.

2. Create `data/quizzes/lesson-22.json`:

```json
{"id":22,"questions":[{"question":"Question text","choices":["A","B","C","D"],"correctIndex":1,"explanation":"Why B is correct."}]}
```

`correctIndex` is zero-based: `0` = A, `1` = B, `2` = C, `3` = D. Every question requires choices, a valid correct index, and a non-empty explanation.

3. Append one entry to the ordered `lessons` array in `data/curriculum.json`:

```json
{"id":22,"lessonFile":"data/lessons/lesson-22.json","quizFile":"data/quizzes/lesson-22.json","cardTitle":"Lesson 22 · Title","summary":"Short curriculum description"}
```

4. Add the new lesson ID to the appropriate course’s `lessonIds` array. For example, the first pharmacology lesson is grouped as:

```json
{"id":"advanced-pharmacology","title":"Phase 2 · Advanced Pharmacology","lessonIds":[31]}
```

Always append future lessons. Never reorder existing lessons because completion data uses zero-based curriculum indexes. Every lesson ID must appear in exactly one course group.

5. Bump the release version consistently:
- visible version text in `index.html`
- every CSS/JS cache query string in `index.html`
- `FNP_APP_VERSION` in `js/version.js`
- `version` in `version.json`

6. Run:

```bash
node tests/static-check.js
```

The static check automatically validates every lesson listed in `data/curriculum.json`; do not hard-code a lesson count.

Completion behavior remains unchanged:
- Correct quiz answer: +20 XP
- First lesson completion: +50 XP
- Daily Practice completion: +80 XP

Legacy progress from localStorage key `fnpQuestV4` is migrated into the v14.54 guest scope. Current progress uses separate `fnpQuestProgressV5:guest` and `fnpQuestProgressV5:user:<user-id>` keys so one account cannot inherit another account's local data. Signed-in cloud synchronization continues through the existing Supabase logic.

## Optional Board-Ready question set

Lessons may add an advanced set without changing their foundation quiz. Add an `advancedQuizFile` path to the lesson's `data/curriculum.json` entry and place the file under `data/advanced-quizzes/`. A Board-Ready file requires 10 original questions with unique `id`, `domain`, `ageGroup`, `system`, four `choices`, matching four-item `rationales`, `correctIndex`, `explanation`, valid `sourceIds`, and reviewed source metadata. The advanced set remains locked until the learner completes that lesson's foundation quiz.

Before publishing, serve through GitHub Pages or a local HTTP server (not `file://`) and manually smoke-test:
- new curriculum card
- lesson body
- all quiz questions/explanations
- Daily Practice
- XP/completion
- Streak/Freeze
- Total Study Days
- light/dark mode
- Supabase sign-in/cloud sync
- version update detection

`data/curriculum-additions.json` is no longer used after v14.34 and can be deleted once the new version is verified.
