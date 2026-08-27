/* Run with Node 18+: node tests/auth-account-switch-check.js */
const assert=require("assert"),fs=require("fs"),path=require("path"),vm=require("vm");
const root=path.resolve(__dirname,"..");

class MemoryStorage{
 constructor(entries={}){this.values=new Map(Object.entries(entries));}
 get length(){return this.values.size;}
 key(index){return [...this.values.keys()][index]??null;}
 getItem(key){return this.values.has(key)?this.values.get(key):null;}
 setItem(key,value){this.values.set(String(key),String(value));}
 removeItem(key){this.values.delete(String(key));}
}

module.exports=(async()=>{
 const legacy={xp:740,streak:4,freeze:1,mistakes:[],completed:[0,1],lastStudyDate:"2026-08-24",streakUpdatedDate:"2026-08-24",totalStudyDays:3,studyDates:["2026-08-22","2026-08-23","2026-08-24"]};
 const localStorage=new MemoryStorage({fnpQuestV4:JSON.stringify(legacy)});
 const elements=new Map();
 const document={getElementById:id=>{if(!elements.has(id))elements.set(id,{style:{},textContent:""});return elements.get(id);}};
 const context=vm.createContext({console,localStorage,document,window:{setTimeout},toast:()=>{},supabaseClient:{}});
 vm.runInContext(fs.readFileSync(path.join(root,"js/progress.js"),"utf8"),context,{filename:"js/progress.js"});
 vm.runInContext(fs.readFileSync(path.join(root,"js/auth.js"),"utf8"),context,{filename:"js/auth.js"});
 vm.runInContext(`
  testProfileSyncs=[];
  testProfiles={
   "user-a":{id:"user-a",xp:120,streak:2,streak_freeze:1,last_study_date:"2026-08-25"},
   "user-b":{id:"user-b",xp:0,streak:0,streak_freeze:1,last_study_date:null}
  };
  ensureProfile=async userId=>testProfiles[userId];
  syncProfileToCloud=async()=>{testProfileSyncs.push(activeCloudUserId());return true;};
  mergeCloudQuizProgress=async()=>true;
  refreshTotalStudyDays=async()=>true;
 `,context);
 const run=source=>vm.runInContext(source,context);

 await run('applyAuthSession({user:{id:"user-a",email:"a@example.test"}})');
 assert.equal(run("state.xp"),120,"Account A should load account A cloud XP");
 assert.equal(run("activeProgressBelongsTo('user-a')"),true);

 await run('applyAuthSession({user:{id:"user-b",email:"b@example.test"}})');
 assert.equal(run("state.xp"),0,"A new account must not receive legacy guest XP or account A XP");
 assert.equal(run("testProfileSyncs.length"),0,"An empty new account must not trigger automatic guest upload");

 run('state.xp=35;saveLocalOnly()');
 await run('applyAuthSession({user:{id:"user-a",email:"a@example.test"}})');
 assert.equal(run("state.xp"),120,"Returning to account A should restore account A progress");

 await run("applyAuthSession(null)");
 assert.equal(run("state.xp"),740,"Signing out should restore the separate guest state");

 console.log("Auth account-switch checks passed: cloud A, new B, returning A, and guest remain isolated.");
})();
