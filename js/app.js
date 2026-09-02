function toast(message){const el=document.getElementById("toast");if(!el)return;el.textContent=message;el.style.display="block";setTimeout(()=>el.style.display="none",1500);}
function openPage(id){const publicPages=new Set(["account","about","privacy","terms"]);if(typeof learningAccessGranted!=="undefined"&&!learningAccessGranted&&!publicPages.has(id)){if(typeof showAccessGate==="function")showAccessGate("Sign in with a registered email before opening FNP Quest.");return false;}document.querySelectorAll(".page").forEach(el=>el.classList.remove("active"));const page=document.getElementById(id);if(page)page.classList.add("active");window.scrollTo(0,0);if(typeof update==="function")update();return Boolean(page);}
function viewPublicInfo(id){const gate=document.getElementById("accessGate");if(gate)gate.hidden=true;document.body.classList.remove("access-locked");openPage(id);}
function clearLocalLearningData(){if(!window.confirm("Clear guest and account-scoped XP, streak, study days, quiz progress, mistakes, and display preferences from this browser? Cloud data is not deleted. This cannot be undone."))return;if(typeof clearAllLocalProgressData==="function")clearAllLocalProgressData();else localStorage.removeItem("fnpQuestV4");["fnpQuestTheme","fnpQuestCourseGroups"].forEach(key=>localStorage.removeItem(key));window.location.reload();}

function initializeTheme(){
 const key="fnpQuestTheme";
 const saved=localStorage.getItem(key);
 const theme=(saved==="dark"||saved==="light")?saved:((window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light");
 document.documentElement.setAttribute("data-theme",theme);
 const button=document.createElement("button");button.id="fnpThemeToggle";button.type="button";
 const sync=()=>{const current=document.documentElement.getAttribute("data-theme");button.textContent=current==="dark"?"☀️ Light":"🌙 Dark";};
 button.onclick=()=>{const next=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";document.documentElement.setAttribute("data-theme",next);localStorage.setItem(key,next);sync();};
 sync();document.body.appendChild(button);
}

let learningContentStarted=false;
function startLearningContent(){if(learningContentStarted)return;learningContentStarted=true;if(typeof initAnonymousAnalytics==="function")initAnonymousAnalytics();if(typeof loadCurriculum==="function")loadCurriculum();}
function registerOfflineWorker(){if(!("serviceWorker" in navigator))return;navigator.serviceWorker.register("sw.js").then(()=>navigator.serviceWorker.ready).then(()=>{const status=document.getElementById("offlineCacheStatus");if(status)status.textContent="Offline course files are ready on this device.";}).catch(error=>{console.warn("Offline cache could not start",error);const status=document.getElementById("offlineCacheStatus");if(status)status.textContent="Offline cache is not ready. Keep this page open while connected and reload.";});}
window.addEventListener("DOMContentLoaded",async()=>{initializeTheme();update();registerOfflineWorker();if(typeof initCloud==="function")await initCloud();});
