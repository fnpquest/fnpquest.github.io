const ANONYMOUS_ANALYTICS_TABLE="anonymous_analytics_events";
const ANONYMOUS_ANALYTICS_OPT_OUT_KEY="fnpQuestAnonymousAnalyticsOptOut";
const ANONYMOUS_ANALYTICS_VISITOR_DAY_KEY="fnpQuestAnonymousAnalyticsVisitorDay";
const ANONYMOUS_ANALYTICS_EVENTS=new Set(["page_view","lesson_open","lesson_quiz_start","lesson_quiz_complete","practice_complete","advanced_practice_complete"]);
const anonymousAnalyticsClient=supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:"fnp-quest-anonymous-analytics"}});
let anonymousAnalyticsInitialized=false;
let anonymousAnalyticsQueue=Promise.resolve();

function analyticsStorageGet(key){try{return localStorage.getItem(key);}catch(error){return null;}}
function analyticsStorageSet(key,value){try{localStorage.setItem(key,value);return true;}catch(error){return false;}}
function analyticsStorageRemove(key){try{localStorage.removeItem(key);}catch(error){}}
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

function anonymousVisitorDayId(){
 const today=analyticsLocalDateKey();
 try{
  const saved=JSON.parse(analyticsStorageGet(ANONYMOUS_ANALYTICS_VISITOR_DAY_KEY)||"null");
  if(saved?.date===today&&/^[0-9a-f-]{36}$/i.test(saved.id||""))return saved.id;
 }catch(error){}
 const id=createAnonymousAnalyticsId();analyticsStorageSet(ANONYMOUS_ANALYTICS_VISITOR_DAY_KEY,JSON.stringify({date:today,id}));return id;
}

function anonymousAnalyticsVersion(){return typeof FNP_APP_VERSION==="string"?FNP_APP_VERSION:"unknown";}
function normalizeAnalyticsLessonNumber(value){const lessonNumber=Number(value);return Number.isInteger(lessonNumber)&&lessonNumber>=1&&lessonNumber<=500?lessonNumber:null;}

function trackAnonymousEvent(eventName,lessonNumber=null){
 if(!anonymousAnalyticsEnabled()||!ANONYMOUS_ANALYTICS_EVENTS.has(eventName))return Promise.resolve(false);
 const payload={event_name:eventName,visitor_day_id:anonymousVisitorDayId(),app_version:anonymousAnalyticsVersion()},normalizedLesson=normalizeAnalyticsLessonNumber(lessonNumber);
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
 if(enabled)analyticsStorageRemove(ANONYMOUS_ANALYTICS_OPT_OUT_KEY);else{analyticsStorageSet(ANONYMOUS_ANALYTICS_OPT_OUT_KEY,"1");analyticsStorageRemove(ANONYMOUS_ANALYTICS_VISITOR_DAY_KEY);}
 updateAnonymousAnalyticsPrivacyUI();
 if(enabled)trackAnonymousEvent("page_view");
}

function toggleAnonymousAnalytics(){setAnonymousAnalyticsEnabled(!anonymousAnalyticsEnabled());}
function initAnonymousAnalytics(){if(anonymousAnalyticsInitialized)return;anonymousAnalyticsInitialized=true;updateAnonymousAnalyticsPrivacyUI();trackAnonymousEvent("page_view");}
