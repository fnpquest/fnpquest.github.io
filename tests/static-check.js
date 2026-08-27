/* Run with Node 18+: node tests/static-check.js */
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
const versionScript=fs.readFileSync(path.join(root,"js/version.js"),"utf8");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"data/curriculum.json"),"utf8"));

if(!Array.isArray(manifest.lessons)||manifest.lessons.length===0)throw new Error("Curriculum must contain at least one lesson");
if(!Array.isArray(manifest.courses)||manifest.courses.length===0)throw new Error("Curriculum must contain at least one course group");

const groupedLessonIds=new Set();
const advancedQuestionIds=new Set();
for(const course of manifest.courses){
 if(!course.id||!course.title||!Array.isArray(course.lessonIds)||!course.lessonIds.length)throw new Error("Each course requires id, title, and lessonIds");
 for(const id of course.lessonIds){
  if(!Number.isInteger(id)||id<1||id>manifest.lessons.length)throw new Error(`Course ${course.id} has invalid lesson ID ${id}`);
  if(groupedLessonIds.has(id))throw new Error(`Lesson ${id} appears in more than one course`);
  groupedLessonIds.add(id);
 }
}
if(groupedLessonIds.size!==manifest.lessons.length)throw new Error("Every lesson must belong to exactly one course");

for(const [i,item] of manifest.lessons.entries()){
 if(item.id!==i+1)throw new Error(`Curriculum IDs must stay ordered: expected ${i+1}, found ${item.id}`);
 if(!item.lessonFile||!item.quizFile)throw new Error(`Lesson ${item.id} is missing lessonFile or quizFile`);
 const lessonPath=path.join(root,item.lessonFile);
 const quizPath=path.join(root,item.quizFile);
 if(!fs.existsSync(lessonPath))throw new Error(`Missing lesson file for Lesson ${item.id}: ${item.lessonFile}`);
 if(!fs.existsSync(quizPath))throw new Error(`Missing quiz file for Lesson ${item.id}: ${item.quizFile}`);
 const lesson=JSON.parse(fs.readFileSync(lessonPath,"utf8"));
 const quiz=JSON.parse(fs.readFileSync(quizPath,"utf8"));
 if(!lesson.html)throw new Error(`Lesson ${item.id} has no body`);
 if(!Array.isArray(quiz.questions)||!quiz.questions.length)throw new Error(`Lesson ${item.id} has no quiz`);
 for(const [qIndex,question] of quiz.questions.entries()){
  if(!question.question||!question.explanation||!Array.isArray(question.choices)||question.choices.length<2||question.correctIndex<0||question.correctIndex>=question.choices.length){
   throw new Error(`Invalid quiz data in Lesson ${item.id}, question ${qIndex+1}`);
  }
  const weakDistractor=/favorite color|hair color|eye color|hand dominance|school mascot|normal shoe color|favorite food|favorite television show|only its price/i;
  if(question.choices.some(choice=>weakDistractor.test(choice)))throw new Error(`Implausible distractor in Lesson ${item.id}, question ${qIndex+1}`);
 }
 if(item.advancedQuizFile){
  const advancedPath=path.join(root,item.advancedQuizFile);
  if(!fs.existsSync(advancedPath))throw new Error(`Missing advanced quiz for Lesson ${item.id}: ${item.advancedQuizFile}`);
  const advanced=JSON.parse(fs.readFileSync(advancedPath,"utf8")),sourceIds=new Set((advanced.sources||[]).map(source=>source.id));
  if(!Array.isArray(advanced.questions)||advanced.questions.length!==10)throw new Error(`Lesson ${item.id} advanced quiz must contain exactly 10 questions`);
  for(const [qIndex,question] of advanced.questions.entries()){
   if(!question.id||advancedQuestionIds.has(question.id))throw new Error(`Missing or duplicate advanced question ID in Lesson ${item.id}, question ${qIndex+1}`);
   advancedQuestionIds.add(question.id);
   if(!["Assess","Diagnose","Plan","Evaluate"].includes(question.domain))throw new Error(`Invalid advanced domain in ${question.id}`);
   if(!question.ageGroup||!question.system||!question.question||!question.explanation)throw new Error(`Missing advanced metadata in ${question.id}`);
   if(!Array.isArray(question.choices)||question.choices.length!==4||!Array.isArray(question.rationales)||question.rationales.length!==4)throw new Error(`Advanced question ${question.id} requires four choices and four rationales`);
   if(!Number.isInteger(question.correctIndex)||question.correctIndex<0||question.correctIndex>=4)throw new Error(`Invalid correctIndex in ${question.id}`);
   if(question.choices.some(choice=>!choice||String(choice).trim().length<2)||question.rationales.some(rationale=>!rationale||rationale.length<20))throw new Error(`Advanced question ${question.id} has an incomplete choice or rationale`);
   if(!Array.isArray(question.sourceIds)||!question.sourceIds.length||question.sourceIds.some(id=>!sourceIds.has(id)))throw new Error(`Advanced question ${question.id} has invalid source references`);
  }
 }
}

if(advancedQuestionIds.size!==100)throw new Error(`Expected 100 Board-Ready questions for Lessons 1–10, found ${advancedQuestionIds.size}`);

for(const file of ["js/app.js","js/lessons.js","js/quiz.js","js/advanced-quiz.js","js/progress.js","js/auth.js","js/supabase.js","js/version.js","css/styles.css"]){
 if(!fs.existsSync(path.join(root,file)))throw new Error(`Missing ${file}`);
}

for(const launchFile of ["docs/ACCOUNT_DELETION.md","docs/SUPABASE_SECURITY.md","supabase/migrations/202608250001_harden_learning_data_rls.sql"]){
 if(!fs.existsSync(path.join(root,launchFile)))throw new Error(`Missing public-launch requirement: ${launchFile}`);
}

for(const launchText of ["Privacy","Terms &amp; Disclaimer","Request Account Deletion","Educational study tool","progressCloudStatus"]){
 if(!index.includes(launchText))throw new Error(`Missing public-launch UI: ${launchText}`);
}
for(const iconFile of ["manifest.webmanifest","assets/icons/favicon-v1-32.png","assets/icons/apple-touch-icon-v1.png","assets/icons/app-icon-v1-192.png","assets/icons/app-icon-v1-512.png","assets/icons/app-icon-v1-maskable-512.png"]){
 if(!fs.existsSync(path.join(root,iconFile)))throw new Error(`Missing install icon asset: ${iconFile}`);
}
const expectedIconSizes={"assets/icons/favicon-v1-32.png":32,"assets/icons/apple-touch-icon-v1.png":180,"assets/icons/app-icon-v1-192.png":192,"assets/icons/app-icon-v1-512.png":512,"assets/icons/app-icon-v1-maskable-512.png":512};
for(const [iconFile,expectedSize] of Object.entries(expectedIconSizes)){
 const png=fs.readFileSync(path.join(root,iconFile));
 if(png.toString("ascii",1,4)!=="PNG"||png.readUInt32BE(16)!==expectedSize||png.readUInt32BE(20)!==expectedSize)throw new Error(`Invalid install icon dimensions: ${iconFile}`);
}
for(const iconMarkup of ['rel="manifest"','rel="apple-touch-icon"','class="brand-icon"']){
 if(!index.includes(iconMarkup))throw new Error(`Missing install icon markup: ${iconMarkup}`);
}
const webManifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.webmanifest"),"utf8"));
if(webManifest.name!=="FNP Quest"||webManifest.display!=="standalone"||!Array.isArray(webManifest.icons)||webManifest.icons.length<3)throw new Error("Invalid web app manifest");
for(const advancedText of ["Advanced FNP Challenge","Advanced FNP Question Bank","advancedLessonList","Weak-Area Review"]){
 if(!index.includes(advancedText))throw new Error(`Missing Board-Ready UI: ${advancedText}`);
}

const progressScript=fs.readFileSync(path.join(root,"js/progress.js"),"utf8");
for(const feature of ["studyDates","addLocalStudyDate","fnpQuestProgressV5:","activateProgressScope","activeProgressBelongsTo","claimGuestProgressForUser"]){
 if(!progressScript.includes(feature))throw new Error(`Missing local study-day feature: ${feature}`);
}

const authScript=fs.readFileSync(path.join(root,"js/auth.js"),"utf8");
for(const feature of ["activateProgressScope(nextUser.id)","activeCloudUserId","guestProgressCanBeImported","importGuestProgress","queueAuthSession"]){
 if(!authScript.includes(feature))throw new Error(`Missing account-isolation feature: ${feature}`);
}
if(/emptyProfile=\{[^}]*xp:state\.xp/.test(authScript))throw new Error("A new cloud profile must not inherit the active device XP");
if(!index.includes("Import This Device's Guest Progress"))throw new Error("Missing explicit guest-progress import UI");

const quizScript=fs.readFileSync(path.join(root,"js/quiz.js"),"utf8");
for(const feature of ["Promise.all","shuffleList","practiceScore","setPracticeLoading"]){
 if(!quizScript.includes(feature))throw new Error(`Missing quiz launch feature: ${feature}`);
}
const advancedScript=fs.readFileSync(path.join(root,"js/advanced-quiz.js"),"utf8");
for(const feature of ["state.completed.includes","startAdvancedMixed","startAdvancedWeakReview","recordAdvancedAnswer","advanced-rationale"]){
 if(!advancedScript.includes(feature))throw new Error(`Missing Board-Ready engine feature: ${feature}`);
}

const rls=fs.readFileSync(path.join(root,"supabase/migrations/202608250001_harden_learning_data_rls.sql"),"utf8");
for(const table of ["profiles","daily_activity","quiz_results"]){
 if(!rls.includes(`alter table public.${table} enable row level security`))throw new Error(`RLS is not enabled for ${table}`);
}
if(!rls.includes("revoke all on table public.profiles from anon"))throw new Error("Anonymous profile grants are not revoked");
if(!rls.includes("from pg_policies"))throw new Error("RLS migration does not remove legacy policies");

const lessonsScript=fs.readFileSync(path.join(root,"js/lessons.js"),"utf8");
if(/curriculum\.length!==\d+/.test(lessonsScript))throw new Error("Lesson loader must not hard-code a curriculum length");
if(lessonsScript.includes("curriculum-additions.json"))throw new Error("Lesson loader should use the single canonical curriculum.json manifest");
if(!lessonsScript.includes("courses="))throw new Error("Lesson loader must support curriculum course groups");
for(const feature of ["toggleCourseGroup","COURSE_GROUP_STATE_KEY","aria-expanded","course-content"]){
 if(!lessonsScript.includes(feature))throw new Error(`Lesson loader is missing expandable-course feature: ${feature}`);
}

const version=JSON.parse(fs.readFileSync(path.join(root,"version.json"),"utf8"));
const match=versionScript.match(/FNP_APP_VERSION="([^"]+)"/);
if(!match||match[1]!==version.version)throw new Error("Version mismatch between version.js and version.json");

const numericVersion=version.version.replace(/^v/,"");
for(const asset of ["css/styles.css","js/app.js","js/progress.js","js/supabase.js","js/auth.js","js/lessons.js","js/quiz.js","js/advanced-quiz.js","js/version.js"]){
 if(!index.includes(`${asset}?v=${numericVersion}`))throw new Error(`Versioned asset URL is missing or stale for ${asset}`);
}

if(fs.existsSync(path.join(root,"data/curriculum-additions.json"))){
 console.warn("Note: data/curriculum-additions.json still exists. It is no longer used and may be deleted after verifying the release.");
}

console.log(`Static checks passed: ${manifest.lessons.length} lessons, ${advancedQuestionIds.size} Board-Ready questions, assets, canonical curriculum, and version parity.`);
