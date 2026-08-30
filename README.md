# FNP Quest

Mobile-friendly lessons, quizzes, and clinical-reasoning practice for Family Nurse Practitioner learners.

Website: https://fnpquest.github.io/

## Adding a New Daily Question

Daily Questions are static HTML pages so Google, Facebook, LinkedIn, and iMessage can read each question without JavaScript or a login.

1. Add one object to `data/daily-questions.json`. Use a new whole-number `day`, a unique kebab-case `slug`, date, clinical scenario, choices, and unique SEO title and description.
2. Set `answerAvailable` to `false` while the answer is not public. Leave `correctAnswer`, `explanation`, and `clinicalPearl` empty or `null` until it is time to publish the answer. The generated page will show: “Answer + clinical reasoning coming tomorrow.”
3. When ready to reveal the answer, set `answerAvailable` to `true`, add `correctAnswer`, at least one explanation paragraph, and an optional clinical pearl.
4. Run `node scripts/generate-daily-questions.js`. This refreshes the archive, each permanent URL, `sitemap.xml`, and `robots.txt`.
5. Commit the data file and the generated files together.

The URL format is:

`https://fnpquest.github.io/daily-questions/day-5-your-topic/`

Google Search Console verification is prepared in `data/site-config.json`. When Google gives you a token, paste only the token into `googleSiteVerification`, run the generator again, then deploy. Leave it blank until you have the real token.
