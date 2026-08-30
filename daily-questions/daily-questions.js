(function(){
 const key="fnpQuestTheme";
 const saved=localStorage.getItem(key);
 const theme=(saved==="dark"||saved==="light")?saved:((window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light");
 document.documentElement.setAttribute("data-theme",theme);
 document.querySelectorAll(".dq-share-button").forEach(button=>button.addEventListener("click",async()=>{
  const title=button.dataset.shareTitle||document.title;
  const url=window.location.href;
  const status=button.parentElement.querySelector(".dq-share-status");
  try{
   if(navigator.share){await navigator.share({title,text:"FNP Quest clinical question",url});if(status)status.textContent="Shared.";return;}
   if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);if(status)status.textContent="Link copied.";return;}
   window.prompt("Copy this link:",url);
  }catch(error){if(error?.name!=="AbortError"&&status)status.textContent="Unable to share right now.";}
 }));
})();
