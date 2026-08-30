/* Generates crawlable Daily Questions HTML, sitemap.xml, and robots.txt for GitHub Pages. */
const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const config=readJson("data/site-config.json");
const questions=readJson("data/daily-questions.json").slice().sort((a,b)=>a.day-b.day);
const version=readJson("version.json").version.replace(/^v/,"");
const baseUrl=String(config.baseUrl||"").replace(/\/$/,"");

function readJson(file){return JSON.parse(fs.readFileSync(path.join(root,file),"utf8"));}
function writeFile(file,content){const destination=path.join(root,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,content);}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));}
function escapeAttribute(value){return escapeHtml(value).replace(/`/g,"&#96;");}
function formatDate(value){return new Intl.DateTimeFormat("en-US",{year:"numeric",month:"long",day:"numeric",timeZone:"UTC"}).format(new Date(`${value}T00:00:00Z`));}
function questionUrl(question){return `${baseUrl}/daily-questions/${question.slug}/`;}
function verificationTag(){return config.googleSiteVerification?`<meta name="google-site-verification" content="${escapeAttribute(config.googleSiteVerification)}">\n`:"";}
function siteHead({title,description,canonical,structuredData}){
 const socialImage=`${baseUrl}/assets/icons/app-icon-v1-512.png`;
 return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#332f78">
<meta name="description" content="${escapeAttribute(description)}">
${verificationTag()}<link rel="canonical" href="${escapeAttribute(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="FNP Quest">
<meta property="og:title" content="${escapeAttribute(title)}">
<meta property="og:description" content="${escapeAttribute(description)}">
<meta property="og:url" content="${escapeAttribute(canonical)}">
<meta property="og:image" content="${escapeAttribute(socialImage)}">
<meta property="og:image:alt" content="FNP Quest logo">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeAttribute(title)}">
<meta name="twitter:description" content="${escapeAttribute(description)}">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/css/styles.css?v=${version}">
<link rel="stylesheet" href="/daily-questions/daily-questions.css?v=${version}">
<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g,"\\u003c")}</script>
</head>`;
}
function pageHeader(){return `<header class="dq-header"><div class="dq-container dq-header-inner"><a class="dq-brand" href="/" aria-label="FNP Quest home"><img src="/assets/icons/app-icon-v1-192.png" alt=""> <span>FNP Quest</span></a><a class="dq-archive-link" href="/daily-questions/">Daily Questions</a></div></header>`;}
function pageFooter(){return `<footer class="dq-footer"><div class="dq-container">© FNP Quest · <a href="/">Study app</a> · <a href="/daily-questions/">Daily Questions</a></div></footer><script src="/daily-questions/daily-questions.js?v=${version}"></script>`;}
function navigation(question,index){
 const previous=questions[index-1];
 const next=questions[index+1];
 return `<nav class="dq-pagination" aria-label="Daily question navigation">${previous?`<a href="/daily-questions/${escapeAttribute(previous.slug)}/">← Previous Question</a>`:"<span></span>"}<a href="/daily-questions/">Daily Questions</a>${next?`<a href="/daily-questions/${escapeAttribute(next.slug)}/">Next Question →</a>`:"<span></span>"}</nav>`;
}
function answerSection(question){
 if(!question.answerAvailable)return `<section class="dq-answer-unavailable card"><h2>Answer status</h2><p>Answer + clinical reasoning coming tomorrow.</p></section>`;
 return `<section class="dq-answer card"><p class="dq-kicker">ANSWER + CLINICAL REASONING</p><h2>Correct answer: ${escapeHtml(question.correctAnswer)}</h2>${question.explanation.map(item=>`<p>${escapeHtml(item)}</p>`).join("")}</section>${question.clinicalPearl?`<section class="dq-pearl card"><h2>Clinical Pearl</h2><p>${escapeHtml(question.clinicalPearl)}</p></section>`:""}`;
}
function questionSchema(question,url){
 const schema={"@context":"https://schema.org","@type":"WebPage",name:question.seoTitle,description:question.seoDescription,url,datePublished:question.date,isPartOf:{"@type":"WebSite",name:config.siteName,url:`${baseUrl}/`},about:{"@type":"Thing",name:question.category}};
 if(question.answerAvailable)schema.mainEntity={"@type":"Question",name:question.question,acceptedAnswer:{"@type":"Answer",text:`${question.correctAnswer}. ${question.explanation.join(" ")}`}};
 return schema;
}
function renderQuestion(question,index){
 const url=questionUrl(question);
 const scenario=question.clinicalScenario.map(paragraph=>`<p>${escapeHtml(paragraph)}</p>`).join("");
 const labs=question.labs.length?`<section class="dq-labs" aria-label="Clinical findings"><h2>Labs</h2><dl>${question.labs.map(lab=>`<div><dt>${escapeHtml(lab.label)}</dt><dd>${escapeHtml(lab.value)}</dd></div>`).join("")}</dl></section>`:"";
 const choices=`<ol class="dq-choices">${question.choices.map(choice=>`<li><span class="dq-choice-label">${escapeHtml(choice.label)}</span><span>${escapeHtml(choice.text)}</span></li>`).join("")}</ol>`;
 return `${siteHead({title:question.seoTitle,description:question.seoDescription,canonical:url,structuredData:questionSchema(question,url)})}
<body>
${pageHeader()}
<main class="dq-container dq-main">
<p class="dq-kicker">CLINICAL QUESTION OF THE DAY</p>
<h1>Day ${question.day}: ${escapeHtml(question.category)}</h1>
<p class="dq-date"><time datetime="${escapeAttribute(question.date)}">${escapeHtml(formatDate(question.date))}</time></p>
<article class="dq-question card">
<h2>${escapeHtml(question.title)}</h2>
<div class="dq-scenario">${scenario}</div>
${labs}
<h2 class="dq-prompt">${escapeHtml(question.question)}</h2>
${choices}
</article>
${answerSection(question)}
<div class="dq-actions"><button type="button" class="dq-share-button" data-share-title="${escapeAttribute(`Day ${question.day}: ${question.title}`)}">Share Question</button><span class="dq-share-status" role="status" aria-live="polite"></span></div>
<p class="dq-disclaimer">Educational use only — not medical advice.</p>
${navigation(question,index)}
</main>
${pageFooter()}
</body>
</html>\n`;
}
function renderArchive(){
 const canonical=`${baseUrl}/daily-questions/`;
 const cards=questions.map(question=>`<article class="dq-archive-card card"><p class="dq-kicker">DAY ${question.day} · ${escapeHtml(question.category)}</p><h2><a href="/daily-questions/${escapeAttribute(question.slug)}/">${escapeHtml(question.title)}</a></h2><p>${escapeHtml(question.seoDescription)}</p><div class="dq-archive-meta"><time datetime="${escapeAttribute(question.date)}">${escapeHtml(formatDate(question.date))}</time><span>${question.answerAvailable?"Answer available":"Answer coming tomorrow"}</span></div><a class="dq-read-link" href="/daily-questions/${escapeAttribute(question.slug)}/">Read question →</a></article>`).join("\n");
 const schema={"@context":"https://schema.org","@type":"CollectionPage",name:"Daily Clinical Questions | FNP Quest",description:"Crawlable daily FNP clinical reasoning questions and answer explanations.",url:canonical,isPartOf:{"@type":"WebSite",name:config.siteName,url:`${baseUrl}/`}};
 return `${siteHead({title:"Daily Clinical Questions | FNP Quest",description:"Daily FNP clinical reasoning questions with permanent URLs, answer explanations, and clinical pearls.",canonical,structuredData:schema})}
<body>
${pageHeader()}
<main class="dq-container dq-main">
<p class="dq-kicker">FNP QUEST</p>
<h1>Clinical Question of the Day</h1>
<p class="dq-intro">Short, board-focused clinical reasoning questions for Family Nurse Practitioner learners. Each question has a permanent, shareable URL.</p>
<section class="dq-archive-list" aria-label="Daily Questions archive">${cards}</section>
<p class="dq-disclaimer">Educational use only — not medical advice.</p>
</main>
${pageFooter()}
</body>
</html>\n`;
}
function validate(){
 if(!baseUrl.startsWith("https://"))throw new Error("data/site-config.json must use an HTTPS baseUrl.");
 const seenDays=new Set(),seenSlugs=new Set();
 for(const question of questions){
  for(const field of ["id","day","date","slug","category","title","question","clinicalScenario","labs","choices","answerAvailable","seoTitle","seoDescription"]){if(question[field]===undefined||question[field]===null)throw new Error(`Daily question ${question.id||"(unknown)"} is missing ${field}.`);}
  if(!Number.isInteger(question.day)||question.day<1||seenDays.has(question.day))throw new Error(`Daily question day must be a unique positive integer: ${question.day}`);
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(question.slug)||seenSlugs.has(question.slug))throw new Error(`Daily question slug must be unique kebab-case: ${question.slug}`);
  if(!Array.isArray(question.clinicalScenario)||!Array.isArray(question.labs)||!Array.isArray(question.choices)||question.choices.length<2)throw new Error(`Daily question ${question.slug} has invalid case data.`);
  if(question.answerAvailable&&(!question.correctAnswer||!Array.isArray(question.explanation)||!question.explanation.length))throw new Error(`Answered question ${question.slug} needs a correct answer and explanation.`);
  seenDays.add(question.day);seenSlugs.add(question.slug);
 }
}
function renderSitemap(){
 const entries=[`${baseUrl}/`,`${baseUrl}/daily-questions/`,...questions.map(question=>questionUrl(question))];
 return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(url=>`  <url><loc>${escapeHtml(url)}</loc></url>`).join("\n")}\n</urlset>\n`;
}
function updateHomeVerification(){
 const indexPath=path.join(root,"index.html");
 const source=fs.readFileSync(indexPath,"utf8");
 const meta=`<meta name="google-site-verification" content="${escapeAttribute(config.googleSiteVerification||"")}">`;
 if(!/<meta name="google-site-verification" content="[^"]*">/.test(source))throw new Error("index.html is missing the Google Search Console verification placeholder.");
 const updated=source.replace(/<meta name="google-site-verification" content="[^"]*">/,meta);
 if(updated!==source)fs.writeFileSync(indexPath,updated);
}

validate();
updateHomeVerification();
writeFile("daily-questions/index.html",renderArchive());
questions.forEach((question,index)=>writeFile(`daily-questions/${question.slug}/index.html`,renderQuestion(question,index)));
writeFile("sitemap.xml",renderSitemap());
writeFile("robots.txt",`User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`);
console.log(`Generated ${questions.length} Daily Questions for ${baseUrl}.`);
