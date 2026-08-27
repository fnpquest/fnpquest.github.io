const FNP_LEGACY_PROGRESS_KEY="fnpQuestV4";
const FNP_PROGRESS_KEY_PREFIX="fnpQuestProgressV5:";
const FNP_GUEST_PROGRESS_SCOPE="guest";
const FNP_GUEST_CLAIM_KEY=FNP_PROGRESS_KEY_PREFIX+"guestClaimedBy";

function defaultAdvancedProgress(){
 return {attempts:0,answered:0,correct:0,completedLessons:[],missedQuestionIds:[],domains:{},lastScore:0,lastTotal:0,lastMode:null};
}

function defaultProgressState(){
 return {xp:0,streak:0,freeze:1,mistakes:[],completed:[],lastStudyDate:null,streakUpdatedDate:null,totalStudyDays:0,studyDates:[],advanced:defaultAdvancedProgress()};
}

function normalizeAdvancedProgress(value){
 const saved=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
 const normalized=Object.assign(defaultAdvancedProgress(),saved);
 normalized.attempts=Math.max(0,Number(normalized.attempts)||0);
 normalized.answered=Math.max(0,Number(normalized.answered)||0);
 normalized.correct=Math.min(normalized.answered,Math.max(0,Number(normalized.correct)||0));
 normalized.completedLessons=Array.isArray(normalized.completedLessons)?[...new Set(normalized.completedLessons.map(Number).filter(Number.isInteger))].sort((a,b)=>a-b):[];
 normalized.missedQuestionIds=Array.isArray(normalized.missedQuestionIds)?[...new Set(normalized.missedQuestionIds.map(String).filter(Boolean))]:[];
 const domains=normalized.domains&&typeof normalized.domains==="object"&&!Array.isArray(normalized.domains)?normalized.domains:{};
 normalized.domains={};
 Object.entries(domains).forEach(([domain,stats])=>{
  const answered=Math.max(0,Number(stats?.answered)||0),correct=Math.min(answered,Math.max(0,Number(stats?.correct)||0));
  if(domain&&answered)normalized.domains[domain]={answered,correct};
 });
 normalized.lastScore=Math.max(0,Number(normalized.lastScore)||0);
 normalized.lastTotal=Math.max(0,Number(normalized.lastTotal)||0);
 normalized.lastMode=normalized.lastMode?String(normalized.lastMode):null;
 return normalized;
}

function normalizeProgressState(value){
 const saved=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
 const normalized=Object.assign(defaultProgressState(),saved);
 normalized.xp=Math.max(0,Number(normalized.xp)||0);
 normalized.streak=Math.max(0,Number(normalized.streak)||0);
 normalized.freeze=Math.max(0,Number(normalized.freeze)||0);
 normalized.mistakes=Array.isArray(normalized.mistakes)?normalized.mistakes:[];
 normalized.completed=Array.isArray(normalized.completed)?[...new Set(normalized.completed.map(Number).filter(Number.isInteger))].sort((a,b)=>a-b):[];
 normalized.advanced=normalizeAdvancedProgress(normalized.advanced);
 normalized.studyDates=Array.isArray(normalized.studyDates)?normalized.studyDates.filter(Boolean):[];
 if(normalized.lastStudyDate&&!normalized.studyDates.includes(normalized.lastStudyDate))normalized.studyDates.push(normalized.lastStudyDate);
 normalized.studyDates=[...new Set(normalized.studyDates)].sort();
 normalized.totalStudyDays=Math.max(Number(normalized.totalStudyDays)||0,normalized.studyDates.length);
 return normalized;
}

function progressStorageKey(scope){return FNP_PROGRESS_KEY_PREFIX+scope;}
function userProgressScope(userId){return "user:"+userId;}

function readStoredProgress(scope){
 try{
  let raw=localStorage.getItem(progressStorageKey(scope));
  if(raw===null&&scope===FNP_GUEST_PROGRESS_SCOPE)raw=localStorage.getItem(FNP_LEGACY_PROGRESS_KEY);
  return normalizeProgressState(raw?JSON.parse(raw):null);
 }catch(error){
  console.warn("Could not read local progress",error);
  return defaultProgressState();
 }
}

function writeStoredProgress(scope,value){
 try{localStorage.setItem(progressStorageKey(scope),JSON.stringify(normalizeProgressState(value)));return true;}
 catch(error){console.warn("Could not save local progress",error);return false;}
}

function progressStateHasLearningData(value){
 const candidate=normalizeProgressState(value);
 return candidate.xp>0||candidate.streak>0||candidate.completed.length>0||candidate.mistakes.length>0||candidate.advanced.answered>0||candidate.advanced.completedLessons.length>0||Boolean(candidate.lastStudyDate)||candidate.studyDates.length>0;
}

let activeProgressScope=FNP_GUEST_PROGRESS_SCOPE;
let state=readStoredProgress(activeProgressScope);
writeStoredProgress(activeProgressScope,state);

function saveLocalOnly(){writeStoredProgress(activeProgressScope,state);}

function activateProgressScope(userId){
 saveLocalOnly();
 activeProgressScope=userId?userProgressScope(userId):FNP_GUEST_PROGRESS_SCOPE;
 state=readStoredProgress(activeProgressScope);
 update();
}

function activeProgressBelongsTo(userId){return Boolean(userId)&&activeProgressScope===userProgressScope(userId);}

function guestProgressCanBeImported(userId){
 if(!activeProgressBelongsTo(userId)||progressStateHasLearningData(state)||localStorage.getItem(FNP_GUEST_CLAIM_KEY))return false;
 return progressStateHasLearningData(readStoredProgress(FNP_GUEST_PROGRESS_SCOPE));
}

function claimGuestProgressForUser(userId){
 if(!guestProgressCanBeImported(userId))return false;
 const guestProgress=readStoredProgress(FNP_GUEST_PROGRESS_SCOPE);
 state=normalizeProgressState(guestProgress);
 if(!writeStoredProgress(activeProgressScope,state))return false;
 writeStoredProgress(FNP_GUEST_PROGRESS_SCOPE,defaultProgressState());
 try{localStorage.setItem(FNP_GUEST_CLAIM_KEY,userId);}catch(error){console.warn("Could not mark guest progress as imported",error);}
 update();
 return true;
}

function clearAllLocalProgressData(){
 try{
  const keys=[];
  for(let index=0;index<localStorage.length;index++)keys.push(localStorage.key(index));
  keys.filter(key=>key===FNP_LEGACY_PROGRESS_KEY||String(key).startsWith(FNP_PROGRESS_KEY_PREFIX)).forEach(key=>localStorage.removeItem(key));
 }catch(error){console.warn("Could not clear local progress",error);}
}

function save(){
 saveLocalOnly();
 if(activeProgressScope===FNP_GUEST_PROGRESS_SCOPE&&progressStateHasLearningData(state)){
  try{localStorage.removeItem(FNP_GUEST_CLAIM_KEY);}catch(error){console.warn("Could not reset guest import marker",error);}
 }
 update();
 if(typeof currentUser!=="undefined"&&currentUser&&activeProgressBelongsTo(currentUser.id)&&typeof syncProfileToCloud==="function")syncProfileToCloud();
}

function update(){
 const values={xp:state.xp,pxp:state.xp,streak:state.streak,pstreak:state.streak,freeze:state.freeze,hometotaldays:state.totalStudyDays||0,ptotaldays:state.totalStudyDays||0};
 Object.entries(values).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.textContent=value;});
 const level=Math.floor(state.xp/500)+1,within=state.xp%500;const levelEl=document.getElementById("level"),toLevel=document.getElementById("toLevel"),bar=document.getElementById("xpbar");if(levelEl)levelEl.textContent=level;if(toLevel)toLevel.textContent=500-within;if(bar)bar.style.width=(within/5)+"%";
 if(typeof renderAdvancedHub==="function")renderAdvancedHub();
}

function localDateKey(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function dateDiffDays(a,b){return Math.round((new Date(b+"T00:00:00")-new Date(a+"T00:00:00"))/86400000);}
function addLocalStudyDate(date){if(state.studyDates.includes(date))return false;state.studyDates.push(date);state.studyDates.sort();state.totalStudyDays=Math.max((Number(state.totalStudyDays)||0)+1,state.studyDates.length);return true;}
function markStudyDay(){const today=localDateKey(),newStudyDate=addLocalStudyDate(today);if(state.streakUpdatedDate===today){if(newStudyDate)save();return false;}const last=state.lastStudyDate;if(!last){state.streak=1;state.lastStudyDate=today;}else{const diff=dateDiffDays(last,today);if(diff===1){state.streak+=1;state.lastStudyDate=today;}else if(diff===2&&state.freeze>0){state.freeze-=1;state.streak+=1;state.lastStudyDate=today;toast("🛡️ Streak Freeze used!");}else if(diff>1){state.streak=1;state.lastStudyDate=today;}}state.streakUpdatedDate=today;save();recordDailyActivity("study",0);refreshTotalStudyDays();return true;}
function streakMessage(){const n=state.streak;if(n===1)return "🔥 Day 1 — streak started!";if(n===3)return "🔥 3-day streak!";if(n===7)return "🔥 7-day streak — one week!";if(n===14)return "🔥 14-day streak — amazing!";if(n===30)return "🔥 30-day streak — FNP Quest Master!";return "🔥 "+n+"-day streak!";}
function addXP(points){state.xp+=points;save();toast("+"+points+" XP ⭐");}
