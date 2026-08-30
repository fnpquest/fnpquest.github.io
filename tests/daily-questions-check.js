/* Run with Node 18+: node tests/daily-questions-check.js */
const assert=require("assert"),fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const config=JSON.parse(read("data/site-config.json"));
const questions=JSON.parse(read("data/daily-questions.json"));
const archive=read("daily-questions/index.html");
const sitemap=read("sitemap.xml");
const robots=read("robots.txt");
const home=read("index.html");

assert.equal(config.baseUrl,"https://fnpquest.github.io","Daily Questions must use the current branded production URL.");
const retiredHost=["ccesm","github","io"].join(".");
assert.ok(!sitemap.includes(retiredHost),"Sitemap must not use the retired production URL.");
assert.ok(robots.includes("Sitemap: https://fnpquest.github.io/sitemap.xml"),"robots.txt must point to the current sitemap.");
assert.ok(archive.includes("Clinical Question of the Day"),"Archive must contain crawlable Daily Questions text.");
assert.ok(config.googleSiteVerification,"Google Search Console verification token must be configured when verification is requested.");
assert.ok(home.includes(`<meta name="google-site-verification" content="${config.googleSiteVerification}">`),"Home page must include the configured Google Search Console verification tag.");

for(const question of questions){
 const relative=`daily-questions/${question.slug}/index.html`;
 const page=read(relative);
 const canonical=`${config.baseUrl}/daily-questions/${question.slug}/`;
 assert.ok(archive.includes(`/daily-questions/${question.slug}/`),`Archive is missing ${question.slug}.`);
 assert.ok(sitemap.includes(canonical),`Sitemap is missing ${question.slug}.`);
 assert.ok(page.includes(`<title>${question.seoTitle}</title>`),`${question.slug} is missing its unique SEO title.`);
 assert.ok(page.includes(`<link rel="canonical" href="${canonical}">`),`${question.slug} is missing its canonical URL.`);
 assert.ok(page.includes('property="og:title"'),`${question.slug} is missing Open Graph metadata.`);
 assert.ok(page.includes(question.question),`${question.slug} question text is not crawlable.`);
 assert.ok(page.includes("Educational use only — not medical advice."),`${question.slug} is missing the disclaimer.`);
 assert.ok(page.includes("dq-share-button"),`${question.slug} is missing the share button.`);
 if(question.answerAvailable){
  assert.ok(page.includes(`Correct answer: ${question.correctAnswer}`),`${question.slug} answer is missing.`);
  assert.ok(page.includes("Clinical Pearl"),`${question.slug} clinical pearl is missing.`);
 }else{
  assert.ok(page.includes("Answer + clinical reasoning coming tomorrow."),`${question.slug} needs its answer-unavailable notice.`);
  assert.ok(!page.includes("Correct answer:"),`${question.slug} must not expose the correct answer yet.`);
  assert.ok(!page.includes("Clinical Pearl"),`${question.slug} must not expose its clinical pearl yet.`);
 }
}

console.log(`Daily Questions checks passed: ${questions.length} crawlable pages, current branded URLs, SEO metadata, and answer gating.`);
