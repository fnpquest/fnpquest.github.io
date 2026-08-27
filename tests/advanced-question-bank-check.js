/* Run with Node 18+: node tests/advanced-question-bank-check.js */
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

const legacy={xp:100,streak:1,freeze:1,mistakes:[],completed:[0],lastStudyDate:null,streakUpdatedDate:null,totalStudyDays:0,studyDates:[]};
const localStorage=new MemoryStorage({fnpQuestV4:JSON.stringify(legacy)}),elements=new Map();
const document={getElementById:id=>elements.get(id)||null,querySelectorAll:()=>[]};
const context=vm.createContext({console,localStorage,document,window:{scrollTo:()=>{}},currentUser:null,update:()=>{},syncProfileToCloud:()=>Promise.resolve(true),shuffleList:items=>items.slice(),escapeCurriculumText:value=>String(value),openPage:()=>{},toast:()=>{},markStudyDay:()=>false});
vm.runInContext(fs.readFileSync(path.join(root,"js/progress.js"),"utf8"),context,{filename:"js/progress.js"});
const manifest=JSON.parse(fs.readFileSync(path.join(root,"data/curriculum.json"),"utf8"));
context.curriculum=manifest.lessons;
vm.runInContext(fs.readFileSync(path.join(root,"js/advanced-quiz.js"),"utf8"),context,{filename:"js/advanced-quiz.js"});
const run=source=>vm.runInContext(source,context);

assert.equal(run("advancedBankItems().length"),10,"Lessons 1–10 should have advanced sets");
assert.equal(run("unlockedAdvancedItems().length"),1,"Only completed foundation lessons should unlock");
assert.equal(run("advancedProgressState().answered"),0,"Legacy progress should gain empty advanced analytics without losing foundation data");

run(`recordAdvancedAnswer({id:"adv-test",domain:"Diagnose",lessonTitle:"Lesson 1",question:"Case",answers:[{text:"Correct",correct:true},{text:"Wrong",correct:false}],explanation:"Reason"},false)`);
assert.equal(run("state.advanced.answered"),1);
assert.equal(run("state.advanced.correct"),0);
assert.deepEqual([...run("state.advanced.missedQuestionIds")],["adv-test"]);
assert.equal(run("state.advanced.domains.Diagnose.answered"),1);

run(`recordAdvancedAnswer({id:"adv-test",domain:"Diagnose",lessonTitle:"Lesson 1",question:"Case",answers:[{text:"Correct",correct:true},{text:"Wrong",correct:false}],explanation:"Reason"},true)`);
assert.equal(run("state.advanced.correct"),1);
assert.equal(run("state.advanced.missedQuestionIds.length"),0,"Correct review should remove a question from weak-area review");

run('activateProgressScope("different-user")');
assert.equal(run("state.advanced.answered"),0,"Advanced analytics must remain isolated per account");
assert.equal(run("state.xp"),0,"Switching the advanced scope must not import guest XP");

console.log("Advanced question-bank checks passed: unlocks, analytics, weak-area review, and account isolation.");
