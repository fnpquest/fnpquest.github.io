/* Run with Node: node tests/offline-access-check.js */
const fs=require("fs"),path=require("path"),vm=require("vm");
const root=path.resolve(__dirname,"..");
const values=new Map();
const context={
 console,
 localStorage:{getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},
 document:{getElementById:()=>null,body:{classList:{add(){},toggle(){}}}},
 navigator:{onLine:false},window:{addEventListener(){},setTimeout},
 supabaseClient:null,activateProgressScope(){},activeProgressBelongsTo(){return true;},saveLocalOnly(){},update(){},refreshTotalStudyDays(){},
 loadCloudProfile(){},guestProgressCanBeImported(){return false;},state:{},toast(){},setTimeout
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,"js/auth.js"),"utf8"),context);

function evaluate(source){return vm.runInContext(source,context);}
if(evaluate("offlineAccessIsValid()"))throw new Error("Offline access must start locked");
evaluate('rememberOfflineAccess({id:"user-1",email:"learner@example.com"})');
if(!evaluate("offlineAccessIsValid()"))throw new Error("A newly verified registered account should receive offline access");
if(evaluate("readOfflineAccess().email")!=="learner@example.com")throw new Error("Offline access must remain bound to the verified email");
values.set("fnpQuestOfflineAccessV1",JSON.stringify({userId:"user-1",email:"learner@example.com",verifiedAt:Date.now()-31*86400000}));
if(evaluate("offlineAccessIsValid()"))throw new Error("Offline access must expire after 30 days");
evaluate("clearOfflineAccess()");
if(values.has("fnpQuestOfflineAccessV1"))throw new Error("Sign-out cleanup must remove the device authorization");

console.log("Offline access checks passed: verified-device grant, account binding, 30-day expiry, and cleanup.");
