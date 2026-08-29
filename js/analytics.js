const ANONYMOUS_ANALYTICS_TABLE="anonymous_analytics_events";
const ANONYMOUS_ANALYTICS_OPT_OUT_KEY="fnpQuestAnonymousAnalyticsOptOut";
const ANONYMOUS_ANALYTICS_VISITOR_KEY="fnpQuestAnonymousAnalyticsVisitor";
const ANONYMOUS_ANALYTICS_VISITOR_DAY_KEY="fnpQuestAnonymousAnalyticsVisitorDay";
const ANONYMOUS_ANALYTICS_SESSION_KEY="fnpQuestAnonymousAnalyticsSession";
const ANONYMOUS_ANALYTICS_SESSION_TIMEOUT_MS=30*60*1000;
const ANONYMOUS_ANALYTICS_EVENTS=new Set(["page_view","lesson_open","lesson_quiz_start","lesson_quiz_complete","practice_complete","advanced_practice_complete"]);
const anonymousAnalyticsClient=supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:"fnp-quest-anonymous-analytics"}});
let anonymousAnalyticsInitialized=false;
let anonymousAnalyticsQueue=Promise.resolve();
let anonymousAnalyticsEphemeralVisitorId="";
let anonymousAnalyticsEphemeralSessionId="";

function analyticsStorageGet(key){try{return localStorage.getItem(key);}catch(error){return null;}}
function analyticsStorageSet(key,value){try{localStorage.setItem(key,value);return true;}catch(error){return false;}}
function analyticsStorageRemove(key){try{localStorage.removeItem(key);}catch(error){}}
function analyticsSessionStorageGet(key){try{return sessionStorage.getItem(key);}catch(error){return null;}}
function analyticsSessionStorageSet(key,value){try{sessionStorage.setItem(key,value);return true;}catch(error){return false;}}
function analyticsSessionStorageRemove(key){try{sessionStorage.removeItem(key);}catch(error){}}
function analyticsLocalDateKey(date=new Date()){return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");}
function analyticsProductionHost(){return window.location.hostname==="fnpquest.github.io";}
function analyticsPrivacySignalEnabled(){return navigator.globalPrivacyControl===true||navigator.doNotTrack==="1"||window.doNotTrack==="1";}
function anonymousAnalyticsEnabled(){return analyticsProductionHost()&&!analyticsPrivacySignalEnabled()&&analyticsStorageGet(ANONYMOUS_ANALYTICS_OPT_OUT_KEY)!=="1";}

function createAnonymousAnalyticsId(){
 if(window.crypto?.randomUUID)return window.crypto.randomUUID();
 const bytes=new Uint8Array(16);window.crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=[...bytes].map(value=>value.toString(16).padStart(2,"0")).join("");
 return hex.slice(0,8)+"-"+hex.slice(8,12)+"-"+hex.slice(12,16)+"-"+hex.slice(16,20)+"-"+hex.slice(20);
}

function isAnonymousAnalyticsId(value){return /^[0-9a-f-]{36}$/i.test(value||"");}
function anonymousVisitorId(){
 const saved=analyticsStorageGet(ANONYMOUS_ANALYTICS_VISITOR_KEY);
 if(isAnonymousAnalyticsId(saved))return saved;
 if(isAnonymousAnalyticsId(anonymousAnalyticsEphemeralVisitorId))return anonymousAnalyticsEphemeralVisitorId;
 const id=createAnonymousAnalyticsId();
 if(!analyticsStorageSet(ANONYMOUS_ANALYTICS_VISITOR_KEY,id))anonymousAnalyticsEphemeralVisitorId=id;
 return id;
}

function anonymousVisitorDayId(){
 const today=analyticsLocalDateKey();
 try{
  const saved=JSON.parse(analyticsStorageGet(ANONYMOUS_ANALYTICS_VISITOR_DAY_KEY)||"null");
  if(saved?.date===today&&isAnonymousAnalyticsId(saved.id))return saved.id;
 }catch(error){}
 const id=createAnonymousAnalyticsId();analyticsStorageSet(ANONYMOUS_ANALYTICS_VISITOR_DAY_KEY,JSON.stringify({date:today,id}));return id;
}

function anonymousAnalyticsSessionId(){
 const now=Date.now();
 try{
  const saved=JSON.parse(analyticsSessionStorageGet(ANONYMOUS_ANALYTICS_SESSION_KEY)||"null");
  if(isAnonymousAnalyticsId(saved?.id)&&Number.isFinite(saved?.lastSeen)&&now>=saved.lastSeen&&now-saved.lastSeen<=ANONYMOUS_ANALYTICS_SESSION_TIMEOUT_MS){analyticsSessionStorageSet(ANONYMOUS_ANALYTICS_SESSION_KEY,JSON.stringify({id:saved.id,lastSeen:now}));return saved.id;}
 }catch(error){}
 if(isAnonymousAnalyticsId(anonymousAnalyticsEphemeralSessionId))return anonymousAnalyticsEphemeralSessionId;
 const id=createAnonymousAnalyticsId();
 if(!analyticsSessionStorageSet(ANONYMOUS_ANALYTICS_SESSION_KEY,JSON.stringify({id,lastSeen:now})))anonymousAnalyticsEphemeralSessionId=id;
 return id;
}

function normalizeAnalyticsSource(value){
 const source=String(value||"").trim().toLowerCase();
 if(!source)return "direct";
 if(source.includes("facebook")||source==="fb")return "facebook";
 if(source.includes("instagram")||source==="ig")return "instagram";
 if(source.includes("google"))return "google";
 if(source.includes("linkedin"))return "linkedin";
 return "other";
}

function anonymousAnalyticsSource(){
 try{const source=new URLSearchParams(window.location.search||"").get("utm_source");if(source)return normalizeAnalyticsSource(source);}catch(error){}
 return normalizeAnalyticsSource(typeof document==="object"?document.referrer:"");
}

function anonymousAnalyticsVersion(){return typeof FNP_APP_VERSION==="string"?FNP_APP_VERSION:"unknown";}
function normalizeAnalyticsLessonNumber(value){const lessonNumber=Number(value);return Number.isInteger(lessonNumber)&&lessonNumber>=1&&lessonNumber<=500?lessonNumber:null;}

function trackAnonymousEvent(eventName,lessonNumber=null){
 if(!anonymousAnalyticsEnabled()||!ANONYMOUS_ANALYTICS_EVENTS.has(eventName))return Promise.resolve(false);
 const payload={event_name:eventName,visitor_id:anonymousVisitorId(),visitor_day_id:anonymousVisitorDayId(),session_id:anonymousAnalyticsSessionId(),source:anonymousAnalyticsSource(),app_version:anonymousAnalyticsVersion()},normalizedLesson=normalizeAnalyticsLessonNumber(lessonNumber);
 if(normalizedLesson!==null)payload.lesson_number=normalizedLesson;
 const task=anonymousAnalyticsQueue.catch(()=>false).then(async()=>{
  const {error}=await anonymousAnalyticsClient.from(ANONYMOUS_ANALYTICS_TABLE).insert(payload);
  if(error){console.warn("Anonymous usage event was not recorded",error.message||error);return false;}
  return true;
 });
 anonymousAnalyticsQueue=task;return task;
}

function updateAnonymousAnalyticsPrivacyUI(){
 const status=document.getElementById("anonymousAnalyticsStatus"),button=document.getElementById("anonymousAnalyticsToggle"),enabled=anonymousAnalyticsEnabled();
 if(status)status.textContent=enabled?"Anonymous usage statistics are currently on for this browser.":"Anonymous usage statistics are currently off for this browser.";
 if(button)button.textContent=enabled?"Turn Off Anonymous Usage Statistics":"Turn On Anonymous Usage Statistics";
}

function setAnonymousAnalyticsEnabled(enabled){
 if(enabled)analyticsStorageRemove(ANONYMOUS_ANALYTICS_OPT_OUT_KEY);else{analyticsStorageSet(ANONYMOUS_ANALYTICS_OPT_OUT_KEY,"1");analyticsStorageRemove(ANONYMOUS_ANALYTICS_VISITOR_KEY);analyticsStorageRemove(ANONYMOUS_ANALYTICS_VISITOR_DAY_KEY);analyticsSessionStorageRemove(ANONYMOUS_ANALYTICS_SESSION_KEY);anonymousAnalyticsEphemeralVisitorId="";anonymousAnalyticsEphemeralSessionId="";}
 updateAnonymousAnalyticsPrivacyUI();
 if(enabled)trackAnonymousEvent("page_view");
}

function toggleAnonymousAnalytics(){setAnonymousAnalyticsEnabled(!anonymousAnalyticsEnabled());}
function initAnonymousAnalytics(){if(anonymousAnalyticsInitialized)return;anonymousAnalyticsInitialized=true;updateAnonymousAnalyticsPrivacyUI();trackAnonymousEvent("page_view");}
