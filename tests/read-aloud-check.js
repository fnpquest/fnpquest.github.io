/* Run with Node 18+: node tests/read-aloud-check.js */
const fs=require("fs"),path=require("path"),vm=require("vm");
const root=path.resolve(__dirname,"..");

class FakeButton{
 constructor(rate){this.dataset=rate?{speechRate:String(rate)}:{};this.disabled=false;this.attributes={};this.listeners={};this.classList={toggle(){}};}
 addEventListener(type,callback){this.listeners[type]=callback;}
 setAttribute(name,value){this.attributes[name]=String(value);}
}
class FakeControls{
 constructor(){
  this.dataset={};this.attributes={};this.status={textContent:"Ready"};
  this.buttons={play:new FakeButton(),pause:new FakeButton(),resume:new FakeButton(),stop:new FakeButton()};
  this.rateButtons=[0.75,1,1.25,1.5].map(rate=>new FakeButton(rate));
 }
 setAttribute(name,value){this.attributes[name]=String(value);}
 set innerHTML(value){this.markup=value;}
 querySelector(selector){
  if(selector===".read-aloud-status")return this.status;
  const match=selector.match(/data-speech-action="([^"]+)"/);
  return match?this.buttons[match[1]]:null;
 }
 querySelectorAll(selector){return selector==="[data-speech-rate]"?this.rateButtons:[];}
}
function contentNode(tagName,textContent,hidden=false){
 return {tagName,textContent,hidden,closest(selector){return hidden&&selector.includes("[hidden]")?{}:null;}};
}
const nodes=[
 contentNode("H1","Lesson 1: BP and DKA"),
 contentNode("P","BP rises. DKA is an emergency."),
 contentNode("FIGCAPTION","Representative sinus rhythm with one P wave before each QRS."),
 contentNode("P","Hidden navigation text",true),
 contentNode("H2","References"),
 contentNode("LI","This citation must not be spoken."),
 contentNode("H2","Clinical Review"),
 contentNode("P","HR and RR should be reassessed.")
];
const title={insertAdjacentElement(position,element){this.position=position;this.controls=element;}};
const readableRoot={
 querySelector(selector){return selector==="h1"?title:null;},
 querySelectorAll(){return nodes;},
 prepend(element){this.controls=element;}
};

const synth={
 queue:[],cancelCalls:0,pauseCalls:0,resumeCalls:0,paused:false,speaking:false,
 getVoices(){return [{name:"English Natural",lang:"en-US",localService:true,default:true}];},
 speak(utterance){this.queue=[utterance];this.speaking=true;if(utterance.onstart)utterance.onstart();},
 cancel(){this.queue=[];this.speaking=false;this.cancelCalls+=1;},
 pause(){this.paused=true;this.pauseCalls+=1;},
 resume(){this.paused=false;this.resumeCalls+=1;}
};
class FakeUtterance{constructor(text){this.text=text;}}
const immediateTimeout=callback=>{callback();return 1;};
const context={console,setTimeout:immediateTimeout,clearTimeout};
context.window={speechSynthesis:synth,SpeechSynthesisUtterance:FakeUtterance,setTimeout:immediateTimeout,addEventListener(){},getComputedStyle(){return {display:"block",visibility:"visible"};}};
context.SpeechSynthesisUtterance=FakeUtterance;
context.document={createElement(){return new FakeControls();},querySelector(){return readableRoot;}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,"js/read-aloud.js"),"utf8"),context);

const api=context.window.FNPReadAloud;
for(const name of ["initializeSpeech","getReadableLessonText","prepareTextForSpeech","splitSpeechIntoChunks","playSpeech","pauseSpeech","resumeSpeech","stopSpeech","setSpeechRate"]){
 if(typeof api[name]!=="function")throw new Error(`Missing Read Aloud API: ${name}`);
}
const prepared=api.prepareTextForSpeech("BP HR RR HTN DM DKA HHS ACE inhibitor ARB SGLT2 GLP-1");
for(const phrase of ["blood pressure","heart rate","respiratory rate","hypertension","diabetes mellitus","diabetic ketoacidosis","hyperosmolar hyperglycemic state","angiotensin converting enzyme inhibitor","A R B","S G L T two","G L P one"]){
 if(!prepared.includes(phrase))throw new Error(`Medical abbreviation was not prepared: ${phrase}`);
}
const electrolyteText=api.prepareTextForSpeech("Na+ retention can affect K+ balance.");
if(!electrolyteText.includes("sodium")||!electrolyteText.includes("potassium"))throw new Error("Electrolyte abbreviations were not prepared");
const longText=("A clinically meaningful sentence should stay readable and reasonably short. ").repeat(30);
const chunks=api.splitSpeechIntoChunks(longText,180);
if(chunks.length<2||chunks.some(chunk=>chunk.length>180))throw new Error("Long lesson text was not split into bounded chunks");

api.initializeSpeech({lessonId:1,readableRoot});
const readable=api.getReadableLessonText();
if(!readable.includes("Lesson 1")||!readable.includes("Clinical Review")||!readable.includes("Diagram. Representative sinus rhythm"))throw new Error("Readable headings or figure captions are missing");
if(readable.includes("citation")||readable.includes("Hidden navigation"))throw new Error("References or hidden content leaked into speech text");
if(title.position!=="afterend")throw new Error("Read Aloud controls were not mounted below the lesson title");
if(!title.controls.markup.includes(">1.0×</button>"))throw new Error("Default speed must be displayed as 1.0×");

api.playSpeech();
if(synth.queue.length!==1||!synth.speaking)throw new Error("Play did not start one utterance");
const openingChunk=synth.queue[0];
openingChunk.onend();
if(synth.queue.length!==1||synth.queue[0]===openingChunk)throw new Error("The next speech chunk did not start automatically");
const firstUtterance=synth.queue[0];
api.playSpeech();
if(synth.queue.length!==1||synth.cancelCalls<2)throw new Error("Repeated Play created an overlapping queue");
api.pauseSpeech();
if(!synth.paused||synth.pauseCalls!==1)throw new Error("Pause did not pause speech");
api.resumeSpeech();
if(synth.paused||synth.resumeCalls<1)throw new Error("Resume did not resume speech");
api.setSpeechRate(1.5);
api.stopSpeech();
if(synth.queue.length||synth.speaking)throw new Error("Stop did not clear speech");
api.playSpeech();
if(synth.queue[0].rate!==1.5)throw new Error("Selected rate was not applied on the next Play");
if(firstUtterance===synth.queue[0])throw new Error("A new Play should use a new utterance");
const cancelsBeforeLessonChange=synth.cancelCalls;
api.initializeSpeech({lessonId:2,readableRoot});
if(synth.queue.length||synth.speaking||synth.cancelCalls<=cancelsBeforeLessonChange)throw new Error("Changing lessons did not stop active speech");

const unsupportedContext={console,setTimeout:immediateTimeout,clearTimeout};
unsupportedContext.window={setTimeout:immediateTimeout,addEventListener(){},getComputedStyle(){return {display:"block",visibility:"visible"};}};
unsupportedContext.document={createElement(){return new FakeControls();},querySelector(){return readableRoot;}};
vm.createContext(unsupportedContext);
vm.runInContext(fs.readFileSync(path.join(root,"js/read-aloud.js"),"utf8"),unsupportedContext);
const unsupportedControls=unsupportedContext.window.FNPReadAloud.initializeSpeech({lessonId:"unsupported",readableRoot});
if(unsupportedControls.status.textContent!=="Read Aloud is not supported on this browser."||!unsupportedControls.buttons.play.disabled)throw new Error("Unsupported browsers must receive a safe disabled state");

console.log("Read Aloud checks passed: extraction, exclusions, abbreviations, chunking/continuation, controls, Play, duplicate prevention, Pause, Resume, Stop, speed, lesson switching, and unsupported-browser fallback.");
