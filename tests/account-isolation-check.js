/* Run with Node 18+: node tests/account-isolation-check.js */
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

const legacy={xp:740,streak:4,freeze:1,mistakes:[],completed:[0,1],lastStudyDate:"2026-08-24",streakUpdatedDate:"2026-08-24",totalStudyDays:3,studyDates:["2026-08-22","2026-08-23","2026-08-24"]};
const localStorage=new MemoryStorage({fnpQuestV4:JSON.stringify(legacy)});
const context=vm.createContext({console,localStorage,currentUser:null,update:()=>{},syncProfileToCloud:()=>Promise.resolve(true),document:{getElementById:()=>null}});
vm.runInContext(fs.readFileSync(path.join(root,"js/progress.js"),"utf8"),context,{filename:"js/progress.js"});
const run=source=>vm.runInContext(source,context);

assert.equal(run("state.xp"),740,"Legacy progress should remain available only as guest progress");
assert.ok(localStorage.getItem("fnpQuestProgressV5:guest"),"Legacy progress should migrate to the guest key");

run('activateProgressScope("user-a")');
assert.equal(run("state.xp"),0,"A new account must not inherit guest XP");
run('state.xp=120;state.streak=2;state.completed=[3];saveLocalOnly()');

run('activateProgressScope("user-b")');
assert.equal(run("state.xp"),0,"A second account must start from its own empty cache");
run('state.xp=35;state.completed=[5];saveLocalOnly()');

run('activateProgressScope("user-a")');
assert.equal(run("state.xp"),120,"Returning to account A must restore only account A progress");
assert.deepEqual([...run("state.completed")],[3]);

run('activateProgressScope("user-b")');
assert.equal(run("state.xp"),35,"Returning to account B must restore only account B progress");
assert.deepEqual([...run("state.completed")],[5]);

run('activateProgressScope("user-c")');
assert.equal(run("state.xp"),0,"An unrecognized account must never receive legacy progress automatically");
assert.equal(run('guestProgressCanBeImported("user-c")'),true,"An empty account may explicitly import unclaimed guest progress");
assert.equal(run('claimGuestProgressForUser("user-c")'),true,"Explicit guest import should succeed once");
assert.equal(run("state.xp"),740,"Explicit import should move guest XP into the chosen account");

run('activateProgressScope("user-d")');
assert.equal(run("state.xp"),0,"Guest import must not leak into another account");
assert.equal(run('guestProgressCanBeImported("user-d")'),false,"Consumed guest progress must not be importable twice");

console.log("Account isolation checks passed: guest, user A, user B, and one-time import remain separate.");
