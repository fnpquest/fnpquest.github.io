/* Run with Node 18+: node tests/anonymous-analytics-check.js */
const assert=require("assert"),crypto=require("crypto"),fs=require("fs"),path=require("path"),vm=require("vm");
const root=path.resolve(__dirname,"..");

class MemoryStorage{
 constructor(){this.values=new Map();}
 getItem(key){return this.values.has(key)?this.values.get(key):null;}
 setItem(key,value){this.values.set(String(key),String(value));}
 removeItem(key){this.values.delete(String(key));}
}

const inserts=[];
const analyticsClient={from:table=>({insert:async payload=>{inserts.push({table,payload});return {error:null};}})};
const localStorage=new MemoryStorage(),sessionStorage=new MemoryStorage();
const context=vm.createContext({
 console,
 Date,
 Uint8Array,
 Promise,
 Set,
 JSON,
 Number,
 String,
 URLSearchParams,
 localStorage,
 sessionStorage,
 navigator:{globalPrivacyControl:false,doNotTrack:"0"},
 document:{getElementById:()=>null,referrer:""},
 window:{location:{hostname:"fnpquest.github.io",search:"?utm_source=facebook"},crypto:{randomUUID:crypto.randomUUID,getRandomValues:array=>crypto.webcrypto.getRandomValues(array)},doNotTrack:"0"},
 supabase:{createClient:()=>analyticsClient},
 SUPABASE_URL:"https://example.supabase.co",
 SUPABASE_PUBLISHABLE_KEY:"browser-safe-test-key",
 FNP_APP_VERSION:"v14.89"
});
vm.runInContext(fs.readFileSync(path.join(root,"js/analytics.js"),"utf8"),context,{filename:"js/analytics.js"});
const run=source=>vm.runInContext(source,context);

(async()=>{
 await run("initAnonymousAnalytics(); anonymousAnalyticsQueue");
 assert.equal(inserts.length,1,"Initialization should record one page view");
 assert.equal(inserts[0].table,"anonymous_analytics_events");
 assert.equal(inserts[0].payload.event_name,"page_view");
 assert.equal(inserts[0].payload.source,"facebook","A UTM source should be reduced to a broad source category");

 const first=inserts[0].payload;
 await run('trackAnonymousEvent("lesson_open",7)');
 const second=inserts[1].payload;
 assert.equal(second.lesson_number,7,"Lesson events should include only the lesson number");
 assert.equal(second.visitor_id,first.visitor_id,"Browser visitor ID should persist across events");
 assert.equal(second.visitor_day_id,first.visitor_day_id,"Visitor-day ID should remain stable during the same day");
 assert.equal(second.session_id,first.session_id,"Session ID should remain stable during the active session");

 await run('trackAnonymousEvent("lesson_quiz_start",7)');
 assert.equal(inserts[2].payload.event_name,"lesson_quiz_start","Starting a lesson quiz should be an allowed anonymous event");
 assert.equal(inserts[2].payload.lesson_number,7,"Quiz-start events should include only the lesson number");

 for(const record of inserts){
  const fields=Object.keys(record.payload).sort();
  assert.ok(fields.every(field=>["app_version","event_name","lesson_number","session_id","source","visitor_day_id","visitor_id"].includes(field)),`Unexpected anonymous field: ${fields.join(", ")}`);
  for(const forbidden of ["user_id","email","xp","streak","score","answer","mistake","referrer","url"])assert.ok(!fields.includes(forbidden),`Anonymous payload exposed ${forbidden}`);
 }

 assert.equal(await run('trackAnonymousEvent("not_allowed",1)'),false,"Unknown events must be rejected client-side");
 const beforeOptOut=inserts.length;
 run("setAnonymousAnalyticsEnabled(false)");
 assert.equal(localStorage.getItem("fnpQuestAnonymousAnalyticsVisitor"),null,"Opt-out should remove the persistent browser ID");
 assert.equal(await run('trackAnonymousEvent("lesson_open",2)'),false,"Opt-out must stop event transmission");
 assert.equal(inserts.length,beforeOptOut,"Opt-out must not enqueue an event");

 context.navigator.globalPrivacyControl=true;
 run("setAnonymousAnalyticsEnabled(true)");
 await run("anonymousAnalyticsQueue");
 assert.equal(inserts.length,beforeOptOut,"Global Privacy Control must prevent event transmission");

 console.log("Anonymous analytics checks passed: minimized V2 data, browser/session IDs, source categories, opt-out, and GPC.");
})().catch(error=>{console.error(error);process.exitCode=1;});
