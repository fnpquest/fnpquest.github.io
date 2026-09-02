let currentUser=null;
let cloudSyncQueue=Promise.resolve();
let authSessionQueue=Promise.resolve();
const FNP_OFFLINE_ACCESS_KEY="fnpQuestOfflineAccessV1";
const FNP_OFFLINE_ACCESS_DAYS=30;
let offlineAccessActive=false;
let learningAccessGranted=false;

function readOfflineAccess(){
 try{const value=JSON.parse(localStorage.getItem(FNP_OFFLINE_ACCESS_KEY)||"null");if(!value?.userId||!value?.email||!value?.verifiedAt)return null;return value;}
 catch(error){console.warn("Could not read offline access",error);return null;}
}
function offlineAccessIsValid(value=readOfflineAccess()){return Boolean(value&&Date.now()-Number(value.verifiedAt)<FNP_OFFLINE_ACCESS_DAYS*86400000);}
function rememberOfflineAccess(user){if(!user?.id||!user?.email)return;try{localStorage.setItem(FNP_OFFLINE_ACCESS_KEY,JSON.stringify({userId:user.id,email:user.email,verifiedAt:Date.now()}));}catch(error){console.warn("Could not save offline access",error);}}
function clearOfflineAccess(){try{localStorage.removeItem(FNP_OFFLINE_ACCESS_KEY);}catch(error){console.warn("Could not clear offline access",error);}}
function showAccessGate(message){const gate=document.getElementById("accessGate"),status=document.getElementById("accessGateMessage");if(status&&message)status.textContent=message;if(gate)gate.hidden=false;if(document.body)document.body.classList.add("access-locked");}
function setLearningAccess(granted,message){learningAccessGranted=Boolean(granted);const gate=document.getElementById("accessGate"),status=document.getElementById("accessGateMessage");if(status&&message)status.textContent=message;if(gate)gate.hidden=learningAccessGranted;if(document.body)document.body.classList.toggle("access-locked",!learningAccessGranted);if(learningAccessGranted&&typeof startLearningContent==="function")startLearningContent();}
function useStoredOfflineAccess(message){const stored=readOfflineAccess();if(!offlineAccessIsValid(stored))return false;offlineAccessActive=true;queueAuthSession({user:{id:stored.userId,email:stored.email}},{offline:true}).catch(error=>console.error("Offline access failed",error));if(message)setAuthMessage(message);return true;}
function copyGateCredentials(){const gateEmail=document.getElementById("accessGateEmail"),gatePassword=document.getElementById("accessGatePassword"),email=document.getElementById("authEmail"),password=document.getElementById("authPassword");if(email&&gateEmail)email.value=gateEmail.value;if(password&&gatePassword)password.value=gatePassword.value;}
function signInFromGate(){copyGateCredentials();signIn();}
function signUpFromGate(){copyGateCredentials();signUp();}

function activeCloudUserId(){
 if(offlineAccessActive||!supabaseClient)return null;
 const userId=currentUser?.id||null;
 return userId&&activeProgressBelongsTo(userId)?userId:null;
}

function stillUsingCloudUser(userId){return activeCloudUserId()===userId;}

async function ensureProfile(userId){
 if(!stillUsingCloudUser(userId))return null;
 const {data,error}=await supabaseClient.from("profiles").select("*").eq("id",userId).maybeSingle();
 if(error){console.error("Cloud profile load failed",error);return null;}
 if(data)return data;
 const emptyProfile={id:userId,xp:0,level:1,streak:0,streak_freeze:1,last_study_date:null};
 const {data:created,error:insertError}=await supabaseClient.from("profiles").insert(emptyProfile).select().single();
 if(insertError){console.error("Cloud profile creation failed",insertError);return null;}
 return created;
}

function profilePayloadFromState(){
 return {xp:state.xp,level:Math.floor(state.xp/500)+1,streak:state.streak,streak_freeze:state.freeze,last_study_date:state.lastStudyDate,updated_at:new Date().toISOString()};
}

function syncProfileToCloud(){
 const userId=activeCloudUserId();
 if(!userId)return Promise.resolve(false);
 const payload=profilePayloadFromState();
 const task=cloudSyncQueue.catch(()=>false).then(async()=>{
  if(!stillUsingCloudUser(userId))return false;
  const {error}=await supabaseClient.from("profiles").update(payload).eq("id",userId);
  if(error){console.error("Cloud profile sync failed",error);return false;}
  return true;
 });
 cloudSyncQueue=task;
 return task;
}

async function recordDailyActivity(type,xp){
 const userId=activeCloudUserId();
 if(!userId)return false;
 const {error}=await supabaseClient.from("daily_activity").upsert({user_id:userId,study_date:localDateKey(),activity_type:type,xp_earned:xp},{onConflict:"user_id,study_date"});
 if(error){console.error("Activity sync failed",error);return false;}
 return true;
}

async function syncStudyDatesToCloud(userId=activeCloudUserId()){
 if(!userId||!stillUsingCloudUser(userId)||!state.studyDates.length)return true;
 const rows=state.studyDates.map(studyDate=>({user_id:userId,study_date:studyDate,activity_type:"study",xp_earned:0}));
 const {error}=await supabaseClient.from("daily_activity").upsert(rows,{onConflict:"user_id,study_date"});
 if(error){console.error("Study-date sync failed",error);return false;}
 return true;
}

async function refreshTotalStudyDays(){
 const userId=activeCloudUserId();
 if(!userId){
  state.totalStudyDays=Math.max(Number(state.totalStudyDays)||0,state.studyDates.length);
  saveLocalOnly();
  update();
  return true;
 }
 try{
  const studyDatesSynced=await syncStudyDatesToCloud(userId);
  const {data,error}=await supabaseClient.from("daily_activity").select("study_date").eq("user_id",userId);
  if(error){console.error("Study-day count failed",error);return false;}
  if(!stillUsingCloudUser(userId))return false;
  state.studyDates=[...new Set([...(state.studyDates||[]),...(data||[]).map(row=>row.study_date).filter(Boolean)])].sort();
  state.totalStudyDays=state.studyDates.length;
  saveLocalOnly();
  update();
  return studyDatesSynced;
 }catch(error){console.error("Study-day count failed",error);return false;}
}

async function recordQuizResult(lessonNumber,score,total){
 const userId=activeCloudUserId();
 if(!userId)return false;
 const {error}=await supabaseClient.from("quiz_results").insert({user_id:userId,lesson_number:lessonNumber,score:score,total_questions:total});
 if(error){console.error("Quiz sync failed",error);return false;}
 return true;
}

async function mergeCloudQuizProgress(userId=activeCloudUserId()){
 if(!userId||!stillUsingCloudUser(userId))return false;
 const {data,error}=await supabaseClient.from("quiz_results").select("lesson_number").eq("user_id",userId).gt("lesson_number",0);
 if(error){console.error("Quiz progress sync failed",error);return false;}
 if(!stillUsingCloudUser(userId))return false;
 const cloudLessons=new Set((data||[]).map(row=>Number(row.lesson_number)).filter(number=>number>0));
 const localLessons=new Set((state.completed||[]).map(index=>Number(index)+1).filter(number=>number>0));
 const missing=[...localLessons].filter(number=>!cloudLessons.has(number));
 if(missing.length){
  const {error:insertError}=await supabaseClient.from("quiz_results").insert(missing.map(number=>({user_id:userId,lesson_number:number,score:0,total_questions:0})));
  if(insertError){console.error("Completed-lesson sync failed",insertError);return false;}
  missing.forEach(number=>cloudLessons.add(number));
 }
 if(!stillUsingCloudUser(userId))return false;
 state.completed=[...new Set([...localLessons,...cloudLessons])].map(number=>number-1).sort((a,b)=>a-b);
 saveLocalOnly();
 return true;
}

async function loadCloudProfile(user){
 const userId=user.id;
 if(!stillUsingCloudUser(userId))return;
 const profile=await ensureProfile(userId);
 if(!profile||!stillUsingCloudUser(userId))return;
 const localHasProgress=progressStateHasLearningData(state);
 const cloudHasProgress=(profile.xp||0)>0||(profile.streak||0)>0||profile.last_study_date||(profile.streak_freeze||1)!==1;
 if(!cloudHasProgress&&localHasProgress){
  await syncProfileToCloud();
 }else if(cloudHasProgress){
  const cloudDate=profile.last_study_date||null,localDate=state.lastStudyDate||null;
  let useLocal=false;
  if(localHasProgress){
   if(localDate&&cloudDate){
    const diff=dateDiffDays(cloudDate,localDate);
    if(diff>0)useLocal=true;
    else if(diff===0&&state.streak>=(profile.streak||0))useLocal=true;
   }else if(localDate&&!cloudDate)useLocal=true;
  }
  if(useLocal){
   await syncProfileToCloud();
  }else if(stillUsingCloudUser(userId)){
   state.xp=Math.max(0,profile.xp||0);
   state.streak=Math.max(0,profile.streak||0);
   state.freeze=profile.streak_freeze??1;
   state.lastStudyDate=cloudDate;
   state.streakUpdatedDate=cloudDate;
   saveLocalOnly();
  }
 }
 await mergeCloudQuizProgress(userId);
 await refreshTotalStudyDays();
 update();
}

function setAuthMessage(message){const el=document.getElementById("authMessage"),gateMessage=document.getElementById("accessGateMessage");if(el)el.textContent=message;if(gateMessage)gateMessage.textContent=message;}

function updateAccountUI(){
 const out=document.getElementById("signedOutBox"),inside=document.getElementById("signedInBox"),email=document.getElementById("accountEmail"),status=document.getElementById("cloudStatus"),progressStatus=document.getElementById("progressCloudStatus"),button=document.getElementById("accountBtn"),guestImport=document.getElementById("guestProgressImport");
 if(!out)return;
 if(currentUser){
  out.style.display="none";
  inside.style.display="block";
  email.textContent=currentUser.email||"Signed in";
  status.textContent=offlineAccessActive?"Offline access · saved progress will sync when connected":"Connected · this account's progress is isolated and syncing";
  if(progressStatus)progressStatus.textContent=offlineAccessActive?"Offline · signed in as "+(currentUser.email||"registered user"):"Cloud Sync: ON · connected to "+(currentUser.email||"your account");
  button.textContent="Account";
  if(guestImport)guestImport.style.display=guestProgressCanBeImported(currentUser.id)?"block":"none";
 }else{
  out.style.display="block";
  inside.style.display="none";
  status.textContent="Sign-in required to use FNP Quest";
  if(progressStatus)progressStatus.textContent="Sign-in required";
  button.textContent="Sign In";
  if(guestImport)guestImport.style.display="none";
 }
}

async function applyAuthSession(session,options={}){
 const nextUser=session?.user||null;
 if(nextUser){
  offlineAccessActive=Boolean(options.offline);
  if(!currentUser||currentUser.id!==nextUser.id||!activeProgressBelongsTo(nextUser.id)){
   saveLocalOnly();
   currentUser=nextUser;
   activateProgressScope(nextUser.id);
  }else currentUser=nextUser;
  if(options.verifiedOnline)rememberOfflineAccess(nextUser);
  if(!offlineAccessActive)await loadCloudProfile(nextUser);else update();
  setLearningAccess(true,offlineAccessActive?"Offline access is active for "+(nextUser.email||"this registered account")+".":"Signed in successfully.");
 }else{
  saveLocalOnly();
  currentUser=null;
  offlineAccessActive=false;
  activateProgressScope(null);
  await refreshTotalStudyDays();
  setLearningAccess(false,"Sign in or create an account while connected. After a successful sign-in, this device can be used offline for up to 30 days.");
 }
 updateAccountUI();
}

function queueAuthSession(session,options={}){
 const task=authSessionQueue.catch(error=>console.error("Previous account transition failed",error)).then(()=>applyAuthSession(session,options));
 authSessionQueue=task;
 return task;
}

async function signUp(){
 const email=document.getElementById("authEmail").value.trim(),password=document.getElementById("authPassword").value;
 if(!email||password.length<6){setAuthMessage("Enter a valid email and a password with at least 6 characters.");return;}
 setAuthMessage("Creating your account…");
 try{
  if(!supabaseClient){setAuthMessage("Connect to the internet to create an account.");return;}
  const {data,error}=await supabaseClient.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+window.location.pathname}});
  if(error){setAuthMessage(error.message);return;}
  if(data.session)await queueAuthSession(data.session,{verifiedOnline:true});
  setAuthMessage(data.session?"Account created and signed in. Guest progress remains separate unless you explicitly import it.":"Account created. Check your email to confirm your account, then return here and sign in. Guest progress will not be imported automatically.");
 }catch(error){console.error("Sign up failed",error);setAuthMessage("Could not reach the cloud service. Check your internet connection or try again later.");}
}

async function signIn(){
 const email=document.getElementById("authEmail").value.trim(),password=document.getElementById("authPassword").value;
 if(!email||!password){setAuthMessage("Enter your email and password.");return;}
 setAuthMessage("Signing in…");
 try{
  if(!supabaseClient){setAuthMessage("Connect to the internet for the first sign-in on this device.");return;}
  const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
  if(error){setAuthMessage(error.message);return;}
  await queueAuthSession(data.session,{verifiedOnline:true});
  setAuthMessage("Signed in successfully. Only this account's progress is loaded.");
 }catch(error){console.error("Sign in failed",error);setAuthMessage("Could not reach the cloud service. Check your internet connection or try again later.");}
}

async function importGuestProgress(){
 const message=document.getElementById("accountActionMessage"),userId=activeCloudUserId();
 if(!userId||!guestProgressCanBeImported(userId)){if(message)message.textContent="There is no unclaimed guest progress available to import.";return;}
 if(!window.confirm("Import this device's guest progress into the signed-in account? Continue only if this progress was created while signed out and belongs to you. It can be imported only once."))return;
 if(!claimGuestProgressForUser(userId)){if(message)message.textContent="Guest progress could not be imported.";return;}
 if(message)message.textContent="Guest progress imported on this device. Syncing it to your account…";
 const profileSynced=await syncProfileToCloud();
 const quizzesSynced=await mergeCloudQuizProgress(userId);
 const datesSynced=await refreshTotalStudyDays();
 updateAccountUI();
 if(message)message.textContent=profileSynced&&quizzesSynced&&datesSynced?"Guest progress imported and synchronized. It cannot be imported into another account.":"Guest progress is now bound to this account on this device. Some cloud sync requests will retry when you next study or sign in.";
}

async function requestAccountDeletion(){
 const message=document.getElementById("accountActionMessage");
 if(!currentUser){if(message)message.textContent="Sign in before requesting account deletion.";return;}
 if(offlineAccessActive||!navigator.onLine){if(message)message.textContent="Connect to the internet before requesting account deletion.";return;}
 if(!window.confirm("Submit a private request to delete your FNP Quest cloud account and synchronized learning data? The request will be reviewed manually."))return;
 if(message)message.textContent="Submitting deletion request…";
 try{
  const {error}=await supabaseClient.auth.updateUser({data:{fnp_quest_account_deletion_requested_at:new Date().toISOString()}});
  if(error){if(message)message.textContent="Could not submit the request: "+error.message;return;}
  if(message)message.textContent="Deletion request submitted. You may sign out now. The request is stored privately with your account for manual processing.";
 }catch(error){console.error("Account deletion request failed",error);if(message)message.textContent="Could not submit the request. Please try again later.";}
}

async function signOut(){
 const message=document.getElementById("accountActionMessage");
 try{
  await syncProfileToCloud();
  clearOfflineAccess();
  const {error}=supabaseClient?await supabaseClient.auth.signOut({scope:"local"}):{error:null};
  if(error)console.warn("Cloud sign-out could not complete",error);
  await queueAuthSession(null);
  toast("Signed out · account access locked");
 }catch(error){console.error("Sign out failed",error);if(message)message.textContent="Could not sign out. Please try again.";}
}

async function initCloud(){
 showAccessGate("Checking registered-account access…");
 if(!supabaseClient){if(useStoredOfflineAccess("Offline access is active for this registered device."))return true;await queueAuthSession(null);return false;}
 try{
  const {data,error}=await supabaseClient.auth.getSession();
  if(error)console.error("Session load failed",error);
  const session=data?.session||null;
  if(session&&navigator.onLine){
   const verified=await supabaseClient.auth.getUser();
   if(!verified.error&&verified.data?.user){await queueAuthSession({...session,user:verified.data.user},{verifiedOnline:true});}
   else if(!useStoredOfflineAccess("The cloud could not be reached. Using this device's existing offline access."))await queueAuthSession(null);
  }else if(!navigator.onLine&&useStoredOfflineAccess("Offline access is active for this registered device.")){
   // The stored device grant, not an unverified local session, authorizes offline use.
  }else await queueAuthSession(null);
 }catch(error){
  console.error("Session validation failed",error);
  if(!useStoredOfflineAccess("The cloud could not be reached. Using this device's existing offline access."))await queueAuthSession(null);
 }
 supabaseClient.auth.onAuthStateChange((event,session)=>{
  if(offlineAccessActive&&(event==="INITIAL_SESSION"||!session))return;
  const verifiedOnline=Boolean(session&&navigator.onLine&&["SIGNED_IN","TOKEN_REFRESHED","USER_UPDATED"].includes(event));
  window.setTimeout(()=>queueAuthSession(session,{verifiedOnline}).catch(error=>console.error("Account transition failed",error)),0);
 });
 window.addEventListener("online",async()=>{
  if(!offlineAccessActive)return;
  try{
   const {data,error}=await supabaseClient.auth.getUser();
   if(error||!data?.user){setAuthMessage("Internet is available, but the account could not be reverified. Offline access remains available until its current verification expires.");return;}
   await queueAuthSession({user:data.user},{verifiedOnline:true});
   setAuthMessage("Account reverified. Cloud synchronization is active again.");
  }catch(error){console.error("Online account revalidation failed",error);}
 });
 return learningAccessGranted;
}
