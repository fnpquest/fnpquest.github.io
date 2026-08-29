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
const context=vm.createContext({
 console,
 Date,
 Uint8Array,
 Promise,
 Set,
 JSON,
 Number,
 String,
 localStorage:new MemoryStorage(),
 navigator:{globalPrivacyControl:false,doNotTrack:"0"},
 document:{getElementById:()=>null},
 window:{location:{hostname:"fnpquest.github.io"},crypto:{randomUUID:crypto.randomUUID,getRandomValues:array=>crypto.webcrypto.getRandomValues(array)},doNotTrack:"0"},
 supabase:{createClient:()=>analyticsClient},
 SUPABASE_URL:"https://example.supabase.co",
 SUPABASE_PUBLISHABLE_KEY:"browser-safe-test-key",
 FNP_APP_VERSION:"v14.73"
});
vm.runInContext(fs.readFileSync(path.join(root,"js/analytics.js"),"utf8"),context,{filename:"js/analytics.js"});
const run=source=>vm.runInContext(source,context);

(async()=>{
 await run("initAnonymousAnalytics(); anonymousAnalyticsQueue");
 assert.equal(inserts.length,1,"Initialization should record one page view");
 assert.equal(inserts[0].table,"anonymous_analytics_events");
 assert.equal(inserts[0].payload.event_name,"page_view");

 const firstVisitorDayId=inserts[0].payload.visitor_day_id;
 await run('trackAnonymousEvent("lesson_open",7)');
 assert.equal(inserts[1].payload.lesson_number,7,"Lesson events should include only the lesson number");
 assert.equal(inserts[1].payload.visitor_day_id,firstVisitorDayId,"Visitor-day ID should remain stable during the same day");

 await run('trackAnonymousEvent("lesson_quiz_start",7)');
 assert.equal(inserts[2].payload.event_name,"lesson_quiz_start","Starting a lesson quiz should be an allowed anonymous event");
 assert.equal(inserts[2].payload.lesson_number,7,"Quiz-start events should include only the lesson number");

 for(const record of inserts){
  const fields=Object.keys(record.payload).sort();
  assert.ok(fields.every(field=>["app_version","event_name","lesson_number","visitor_day_id"].includes(field)),`Unexpected anonymous field: ${fields.join(", ")}`);
  for(const forbidden of ["user_id","email","xp","streak","score","answer","mistake"])assert.ok(!fields.includes(forbidden),`Anonymous payload exposed ${forbidden}`);
 }

 assert.equal(await run('trackAnonymousEvent("not_allowed",1)'),false,"Unknown events must be rejected client-side");
 const beforeOptOut=inserts.length;
 run("setAnonymousAnalyticsEnabled(false)");
 assert.equal(await run('trackAnonymousEvent("lesson_open",2)'),false,"Opt-out must stop event transmission");
 assert.equal(inserts.length,beforeOptOut,"Opt-out must not enqueue an event");

 context.navigator.globalPrivacyControl=true;
 run("setAnonymousAnalyticsEnabled(true)");
 await run("anonymousAnalyticsQueue");
 assert.equal(inserts.length,beforeOptOut,"Global Privacy Control must prevent event transmission");

 console.log("Anonymous analytics checks passed: data minimization, daily pseudonym, event allowlist, opt-out, and GPC.");
})().catch(error=>{console.error(error);process.exitCode=1;});
