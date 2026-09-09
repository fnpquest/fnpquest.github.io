(function(){
 "use strict";

 const DEFAULT_RATE=1;
 const MAX_CHUNK_LENGTH=450;
 const RATE_OPTIONS=[0.75,1,1.25,1.5];
 const REFERENCE_HEADING=/^(references?|sources?|selected references?|further reading(?: and clinical references)?|clinical references?|evidence anchors?|bibliography)\b/i;
 const state={
  providerName:"browser",
  readableRoot:null,
  controls:null,
  lessonId:null,
  chunks:[],
  chunkIndex:0,
  rate:DEFAULT_RATE,
  activeRate:DEFAULT_RATE,
  status:"ready",
  runToken:0,
  currentUtterance:null
 };

 const BrowserSpeechProvider={
  isSupported(){return "speechSynthesis" in window&&"SpeechSynthesisUtterance" in window;},
  getVoices(){return this.isSupported()?window.speechSynthesis.getVoices():[];},
  speak(utterance){window.speechSynthesis.speak(utterance);},
  pause(){window.speechSynthesis.pause();},
  resume(){window.speechSynthesis.resume();},
  cancel(){
   if(!this.isSupported())return;
   window.speechSynthesis.cancel();
   // The specification allows cancel() to leave the global synthesizer paused.
   // Resume an empty queue so the next user-initiated Play can start reliably.
   if(window.speechSynthesis.paused)window.speechSynthesis.resume();
  }
 };

 // A provider registry keeps the controls independent from the synthesis engine.
 // A future MP3 or cloud provider can implement this same small interface.
 const audioProviders={browser:BrowserSpeechProvider};
 function activeProvider(){return audioProviders[state.providerName];}

 function normalizeSpaces(value){return String(value||"").replace(/\u00a0/g," ").replace(/[ \t]+/g," ").replace(/\s*\n\s*/g," ").trim();}

 function prepareTextForSpeech(text){
  let prepared=normalizeSpaces(text);
  const replacements=[
   [/\bHFrEF\b/g,"heart failure with reduced ejection fraction"],
   [/\bHFpEF\b/g,"heart failure with preserved ejection fraction"],
   [/\bT1DM\b/g,"type one diabetes mellitus"],
   [/\bT2DM\b/g,"type two diabetes mellitus"],
   [/\bSGLT[- ]?2\b/gi,"S G L T two"],
   [/\bGLP[- ]?1\b/gi,"G L P one"],
   [/\bACE inhibitors?\b/gi,match=>match.toLowerCase().endsWith("s")?"angiotensin converting enzyme inhibitors":"angiotensin converting enzyme inhibitor"],
   [/\bARBs\b/g,"A R B medications"],
   [/\bARB\b/g,"A R B"],
   [/\bDKA\b/g,"diabetic ketoacidosis"],
   [/\bHHS\b/g,"hyperosmolar hyperglycemic state"],
   [/\bHTN\b/g,"hypertension"],
   [/\bDM\b/g,"diabetes mellitus"],
   [/\bCKD\b/g,"chronic kidney disease"],
   [/\bAKI\b/g,"acute kidney injury"],
   [/\beGFR\b/g,"estimated glomerular filtration rate"],
   [/\bGFR\b/g,"glomerular filtration rate"],
   [/\bRAAS\b/g,"renin angiotensin aldosterone system"],
   [/\bACTH\b/g,"A C T H"],
   [/\bTSH\b/g,"T S H"],
   [/\bADH\b/g,"antidiuretic hormone"],
   [/\bCO2\b/g,"carbon dioxide"],
   [/\bO2\b/g,"oxygen"],
   [/\bNa\+(?!\w)/g,"sodium"],
   [/\bK\+(?!\w)/g,"potassium"],
   [/\bECG\b/g,"E C G"],
   [/\bBNP\b/g,"B N P"],
   [/\bCAD\b/g,"coronary artery disease"],
   [/\bMI\b/g,"myocardial infarction"],
   [/\bSVT\b/g,"S V T"],
   [/\bVT\b/g,"ventricular tachycardia"],
   [/\bVF\b/g,"ventricular fibrillation"],
   [/\bAF\b/g,"atrial fibrillation"],
   [/\bLDL\b/g,"L D L"],
   [/\bHDL\b/g,"H D L"],
   [/\bBP\b/g,"blood pressure"],
   [/\bHR\b/g,"heart rate"],
   [/\bRR\b/g,"respiratory rate"],
   [/\bACE\b/g,"A C E"],
   [/\bT4\b/g,"T four"],
   [/\bT3\b/g,"T three"],
   [/\bmg\/dL\b/gi,"milligrams per deciliter"],
   [/\bmEq\/L\b/gi,"milliequivalents per liter"],
   [/\bmm\s?Hg\b/gi,"millimeters of mercury"],
   [/\bbpm\b/gi,"beats per minute"],
   [/↑/g," increases "],
   [/↓/g," decreases "],
   [/[→⇒]/g," leads to "],
   [/[⇌↔]/g," is in equilibrium with "],
   [/×/g," times "]
  ];
  replacements.forEach(([pattern,replacement])=>{prepared=prepared.replace(pattern,replacement);});
  return normalizeSpaces(prepared).replace(/\s+([,.;:!?])/g,"$1");
 }

 function splitLongPiece(text,maxLength){
  const words=normalizeSpaces(text).split(" "),parts=[];
  let current="";
  words.forEach(word=>{
   const candidate=current?current+" "+word:word;
   if(candidate.length>maxLength&&current){parts.push(current);current=word;}
   else current=candidate;
  });
  if(current)parts.push(current);
  return parts;
 }

 function splitSpeechIntoChunks(text,maxLength=MAX_CHUNK_LENGTH){
  const clean=normalizeSpaces(text);
  if(!clean)return [];
  if(clean.length<=maxLength)return [clean];
  const sentences=clean.match(/[^.!?]+(?:[.!?]+[”"']?|$)/g)||[clean];
  const chunks=[];
  let current="";
  sentences.map(normalizeSpaces).filter(Boolean).forEach(sentence=>{
   const pieces=sentence.length>maxLength?splitLongPiece(sentence,maxLength):[sentence];
   pieces.forEach(piece=>{
    const candidate=current?current+" "+piece:piece;
    if(candidate.length>maxLength&&current){chunks.push(current);current=piece;}
    else current=candidate;
   });
  });
  if(current)chunks.push(current);
  return chunks;
 }

 function isHiddenOrSkipped(element){
  if(!element||element.closest(".read-aloud-controls,[data-tts-skip],script,style,nav,footer,button,[hidden],[aria-hidden='true']"))return true;
  if(typeof window.getComputedStyle==="function"){
   let current=element;
   while(current){
    const style=window.getComputedStyle(current);
    if(style.display==="none"||style.visibility==="hidden")return true;
    current=current.parentElement;
   }
  }
  return false;
 }

 function readableSegments(root=state.readableRoot){
  if(!root||typeof root.querySelectorAll!=="function")return [];
  const segments=[];
  let skippedHeadingLevel=0;
  root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li").forEach(element=>{
   if(isHiddenOrSkipped(element))return;
   const headingMatch=element.tagName.match(/^H([1-6])$/),headingLevel=headingMatch?Number(headingMatch[1]):0;
   const text=normalizeSpaces(element.textContent);
   if(headingLevel){
    if(skippedHeadingLevel&&headingLevel<=skippedHeadingLevel)skippedHeadingLevel=0;
    if(REFERENCE_HEADING.test(text)){skippedHeadingLevel=headingLevel;return;}
   }
   if(skippedHeadingLevel||!text)return;
   const prefix=headingLevel?"Section. ":element.tagName==="LI"?"Point. ":"";
   const prepared=prepareTextForSpeech(prefix+text+(text.match(/[.!?]$/)?"":"."));
   if(prepared)segments.push(prepared);
  });
  return segments;
 }

 function getReadableLessonText(root=state.readableRoot){return readableSegments(root).join("\n\n");}
 function getReadableLessonChunks(root=state.readableRoot){return readableSegments(root).flatMap(segment=>splitSpeechIntoChunks(segment));}

 function chooseEnglishVoice(){
  const voices=activeProvider().getVoices().filter(voice=>/^en(?:-|_)/i.test(voice.lang||""));
  if(!voices.length)return null;
  const score=voice=>{
   let value=/^en[-_]US$/i.test(voice.lang||"")?100:50;
   if(/natural|enhanced|premium|neural/i.test(voice.name||""))value+=20;
   if(voice.localService)value+=5;
   if(voice.default)value+=2;
   return value;
  };
  return voices.sort((a,b)=>score(b)-score(a))[0]||null;
 }

 function statusLabel(status){
  if(status==="playing")return "Playing";
  if(status==="paused")return "Paused";
  if(status==="stopped")return "Stopped";
  if(status==="finished")return "Finished";
  if(status==="unsupported")return "Read Aloud is not supported on this browser.";
  if(status==="error")return "Read Aloud could not continue. Please press Play to try again.";
  return "Ready";
 }

 function updateControls(detail=""){
  if(!state.controls)return;
  const status=state.controls.querySelector(".read-aloud-status");
  if(status)status.textContent=detail||statusLabel(state.status);
  const playing=state.status==="playing",paused=state.status==="paused",active=playing||paused;
  const supported=activeProvider().isSupported();
  const play=state.controls.querySelector('[data-speech-action="play"]');
  const pause=state.controls.querySelector('[data-speech-action="pause"]');
  const resume=state.controls.querySelector('[data-speech-action="resume"]');
  const stop=state.controls.querySelector('[data-speech-action="stop"]');
  if(play)play.disabled=!supported||active;
  if(pause)pause.disabled=!supported||!playing;
  if(resume)resume.disabled=!supported||!paused;
  if(stop)stop.disabled=!supported||!active;
  state.controls.querySelectorAll("[data-speech-rate]").forEach(button=>{
   const selected=Number(button.dataset.speechRate)===state.rate;
   button.setAttribute("aria-pressed",String(selected));
   button.classList.toggle("active",selected);
   button.disabled=!supported;
  });
 }

 function setStatus(status,detail=""){state.status=status;updateControls(detail);}

 function stopSpeech(options={}){
  state.runToken+=1;
  activeProvider().cancel();
  state.chunks=[];
  state.chunkIndex=0;
  state.currentUtterance=null;
  if(!options.silent)setStatus("stopped");
  else{state.status="stopped";updateControls("Stopped");}
 }

 function speakNextChunk(runToken){
  if(runToken!==state.runToken)return;
  if(state.chunkIndex>=state.chunks.length){
   state.currentUtterance=null;
   setStatus("finished");
   return;
  }
  const utterance=new window.SpeechSynthesisUtterance(state.chunks[state.chunkIndex]);
  utterance.lang="en-US";
  utterance.rate=state.activeRate;
  utterance.pitch=1;
  const voice=chooseEnglishVoice();
  if(voice)utterance.voice=voice;
  const chunkNumber=state.chunkIndex+1,total=state.chunks.length;
  utterance.onstart=()=>{if(runToken===state.runToken)setStatus("playing","Playing · section "+chunkNumber+" of "+total);};
  utterance.onend=()=>{
   if(runToken!==state.runToken)return;
   state.currentUtterance=null;
   state.chunkIndex+=1;
   window.setTimeout(()=>speakNextChunk(runToken),20);
  };
  utterance.onerror=event=>{
   if(runToken!==state.runToken)return;
   state.currentUtterance=null;
   if(event.error==="canceled"||event.error==="interrupted")setStatus("stopped");
   else setStatus("error");
  };
  state.currentUtterance=utterance;
  setStatus("playing","Playing · section "+chunkNumber+" of "+total);
  try{activeProvider().speak(utterance);}catch(error){console.error(error);state.currentUtterance=null;setStatus("error");}
 }

 function playSpeech(){
  if(!activeProvider().isSupported()){setStatus("unsupported");return;}
  stopSpeech({silent:true});
  state.chunks=getReadableLessonChunks();
  if(!state.chunks.length){setStatus("error","No readable lesson content was found.");return;}
  state.chunkIndex=0;
  state.activeRate=state.rate;
  const runToken=state.runToken;
  speakNextChunk(runToken);
 }

 function pauseSpeech(){
  if(state.status!=="playing")return;
  activeProvider().pause();
  setStatus("paused");
 }

 function resumeSpeech(){
  if(state.status!=="paused")return;
  activeProvider().resume();
  setStatus("playing","Playing · section "+(state.chunkIndex+1)+" of "+state.chunks.length);
 }

 function setSpeechRate(rate){
  const value=Number(rate);
  if(!RATE_OPTIONS.includes(value))return;
  state.rate=value;
  const deferred=state.status==="playing"||state.status==="paused";
  updateControls(deferred?"Speed set to "+formatSpeechRate(value)+" · applies next time you press Play":"Ready · "+formatSpeechRate(value)+" speed");
 }

 function formatSpeechRate(rate){return Number(rate)===1?"1.0×":rate+"×";}

 function createControls(lessonId){
  const controls=document.createElement("section");
  controls.className="read-aloud-controls";
  controls.dataset.ttsSkip="true";
  controls.setAttribute("role","region");
  controls.setAttribute("aria-labelledby","readAloudTitle-"+lessonId);
  controls.innerHTML='<div class="read-aloud-title" id="readAloudTitle-'+lessonId+'">🔊 Listen to Lesson</div><div class="read-aloud-actions"><button type="button" data-speech-action="play" aria-label="Play lesson audio">▶ Play</button><button type="button" data-speech-action="pause" aria-label="Pause lesson audio">⏸ Pause</button><button type="button" data-speech-action="resume" aria-label="Resume lesson audio">▶ Resume</button><button type="button" data-speech-action="stop" aria-label="Stop lesson audio">⏹ Stop</button></div><div class="read-aloud-speed"><span id="readAloudSpeedLabel-'+lessonId+'">Speed</span><div class="read-aloud-rate-options" role="group" aria-labelledby="readAloudSpeedLabel-'+lessonId+'">'+RATE_OPTIONS.map(rate=>'<button type="button" class="read-aloud-rate" data-speech-rate="'+rate+'" aria-label="Set lesson audio speed to '+rate+' times" aria-pressed="'+(rate===state.rate)+'">'+formatSpeechRate(rate)+'</button>').join("")+'</div></div><p class="read-aloud-status" role="status" aria-live="polite">Ready</p>';
  controls.querySelector('[data-speech-action="play"]').addEventListener("click",playSpeech);
  controls.querySelector('[data-speech-action="pause"]').addEventListener("click",pauseSpeech);
  controls.querySelector('[data-speech-action="resume"]').addEventListener("click",resumeSpeech);
  controls.querySelector('[data-speech-action="stop"]').addEventListener("click",()=>stopSpeech());
  controls.querySelectorAll("[data-speech-rate]").forEach(button=>button.addEventListener("click",()=>setSpeechRate(button.dataset.speechRate)));
  return controls;
 }

 function initializeSpeech(options={}){
  stopSpeech({silent:true});
  state.readableRoot=options.readableRoot||document.querySelector(".lesson-readable-content");
  state.lessonId=options.lessonId||"current";
  state.controls=createControls(state.lessonId);
  const title=state.readableRoot&&state.readableRoot.querySelector("h1");
  if(title)title.insertAdjacentElement("afterend",state.controls);
  else if(state.readableRoot)state.readableRoot.prepend(state.controls);
  if(activeProvider().isSupported())setStatus("ready");
  else setStatus("unsupported");
  return state.controls;
 }

 window.addEventListener("pagehide",()=>stopSpeech({silent:true}));
 window.FNPReadAloud={
  initializeSpeech,getReadableLessonText,prepareTextForSpeech,splitSpeechIntoChunks,
  playSpeech,pauseSpeech,resumeSpeech,stopSpeech,setSpeechRate,
  providers:audioProviders
 };
 // Function aliases keep the integration small and make the public API easy to extend.
 window.initializeSpeech=initializeSpeech;
 window.getReadableLessonText=getReadableLessonText;
 window.prepareTextForSpeech=prepareTextForSpeech;
 window.splitSpeechIntoChunks=splitSpeechIntoChunks;
 window.playSpeech=playSpeech;
 window.pauseSpeech=pauseSpeech;
 window.resumeSpeech=resumeSpeech;
 window.stopSpeech=stopSpeech;
 window.setSpeechRate=setSpeechRate;
})();
