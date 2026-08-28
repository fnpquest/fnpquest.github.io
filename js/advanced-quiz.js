let advancedSession={questions:[],index:0,score:0,mode:null,lessonIndex:null,label:"",answered:false};
let advancedLoading=false;
const ADVANCED_DOMAIN_ORDER=["Assess","Diagnose","Plan","Evaluate"];

function advancedProgressState(){
 if(!state.advanced)state.advanced=defaultAdvancedProgress();
 return state.advanced;
}

function advancedBankItems(){return curriculum.map((item,index)=>({item,index})).filter(entry=>Boolean(entry.item.advancedQuizFile));}
function unlockedAdvancedItems(){return advancedBankItems().filter(entry=>state.completed.includes(entry.index));}
function advancedAccuracy(){const progress=advancedProgressState();return progress.answered?Math.round(progress.correct/progress.answered*100):null;}

function openAdvancedHub(){openPage("advanced");renderAdvancedHub();}

function renderAdvancedHub(){
 const progress=advancedProgressState(),bank=advancedBankItems(),unlocked=unlockedAdvancedItems(),accuracy=advancedAccuracy();
 const values={advancedAccuracy:accuracy===null?"—":accuracy+"%",advancedAnswered:progress.answered,advancedCompleted:progress.completedLessons.length};
 Object.entries(values).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.textContent=value;});
 const homeUnlocked=document.getElementById("advancedUnlockedHome"),homeAccuracy=document.getElementById("advancedAccuracyHome"),progressSummary=document.getElementById("advancedProgressSummary");
 if(homeUnlocked)homeUnlocked.textContent=unlocked.length+" / "+(bank.length||10)+" topics unlocked";
 if(homeAccuracy)homeAccuracy.textContent=accuracy===null?"No advanced answers yet":accuracy+"% accuracy · "+progress.answered+" answered";
 if(progressSummary)progressSummary.textContent=accuracy===null?"No advanced questions answered yet.":progress.answered+" answered · "+accuracy+"% accuracy · "+progress.completedLessons.length+" deep dives completed";
 const mixedButton=document.getElementById("advancedMixedBtn"),weakButton=document.getElementById("advancedWeakBtn");
 if(mixedButton)mixedButton.disabled=advancedLoading||!unlocked.length;
 if(weakButton)weakButton.disabled=advancedLoading||!progress.missedQuestionIds.length||!unlocked.length;
 const list=document.getElementById("advancedLessonList");
 if(list){
  if(!bank.length){list.innerHTML='<div class="card"><p class="small">Advanced content is loading…</p></div>';}
  else list.innerHTML=bank.map(({item,index})=>{
   const unlockedLesson=state.completed.includes(index),completed=progress.completedLessons.includes(index),status=completed?"Completed · retry anytime":unlockedLesson?"Unlocked":"Complete the foundation quiz first";
   const title=item.cardTitle.replace(/^Lesson \d+ · /,"").replace(/&amp;/g,"&");
   return '<div class="card advanced-lesson-row'+(unlockedLesson?'':' locked')+'"><div><h3>'+escapeCurriculumText(title)+'</h3><p class="small">'+escapeCurriculumText(status)+'</p></div>'+(unlockedLesson?'<button onclick="startAdvancedLesson('+index+')">'+(completed?'Retry':'Start')+'</button>':'<span class="advanced-lock">🔒 Locked</span>')+'</div>';
  }).join("");
 }
 renderAdvancedDomainStats();
}

function renderAdvancedDomainStats(){
 const box=document.getElementById("advancedDomainStats");if(!box)return;
 const domains=advancedProgressState().domains,available=ADVANCED_DOMAIN_ORDER.filter(domain=>domains[domain]?.answered);
 if(!available.length){box.innerHTML='<p class="small">Answer advanced questions to build your domain profile.</p>';return;}
 box.innerHTML=available.map(domain=>{const stats=domains[domain],percent=Math.round(stats.correct/stats.answered*100);return '<div class="advanced-domain-row"><div class="advanced-domain-label"><span>'+escapeCurriculumText(domain)+'</span><span>'+percent+'% · '+stats.correct+'/'+stats.answered+'</span></div><div class="advanced-domain-bar"><i style="width:'+percent+'%"></i></div></div>';}).join("");
}

function setAdvancedLoading(loading){advancedLoading=loading;const page=document.getElementById("advanced");if(page)page.classList.toggle("advanced-loading",loading);renderAdvancedHub();}

async function advancedQuestionsForLesson(index){
 const quiz=await getAdvancedQuiz(index),sourceMap=new Map((quiz.sources||[]).map(source=>[source.id,source]));
 if(!Array.isArray(quiz.questions)||!quiz.questions.length)throw new Error("Advanced quiz contains no questions for lesson "+(index+1));
 return quiz.questions.map(question=>Object.assign({},question,{lessonIndex:index,lessonTitle:curriculum[index].cardTitle,sources:(question.sourceIds||[]).map(id=>sourceMap.get(id)).filter(Boolean)}));
}

function prepareAdvancedQuestion(question){
 const answers=shuffleList(question.choices.map((text,index)=>({text,rationale:question.rationales[index],correct:index===question.correctIndex})));
 return Object.assign({},question,{answers});
}

async function startAdvancedLesson(index){
 if(!state.completed.includes(index)){toast("Complete this lesson's foundation quiz to unlock the advanced set.");return;}
 setAdvancedLoading(true);
 try{const questions=await advancedQuestionsForLesson(index);beginAdvancedSession(shuffleList(questions).map(prepareAdvancedQuestion),"lesson",index,curriculum[index].cardTitle+" · Deep Dive");}
 catch(error){console.error(error);toast("Advanced questions could not load. Please try again.");}
 finally{setAdvancedLoading(false);}
}

async function startAdvancedMixed(){
 const unlocked=unlockedAdvancedItems();if(!unlocked.length){toast("Complete a foundation lesson quiz to unlock Board-Ready questions.");return;}
 setAdvancedLoading(true);
 try{const groups=await Promise.all(unlocked.map(entry=>advancedQuestionsForLesson(entry.index))),questions=shuffleList(groups.flat()).slice(0,10).map(prepareAdvancedQuestion);beginAdvancedSession(questions,"mixed",null,"Mixed Board Review");}
 catch(error){console.error(error);toast("Advanced questions could not load. Please try again.");}
 finally{setAdvancedLoading(false);}
}

async function startAdvancedWeakReview(){
 const unlocked=unlockedAdvancedItems(),missed=new Set(advancedProgressState().missedQuestionIds);if(!missed.size){toast("No missed advanced questions to review yet.");return;}if(!unlocked.length){toast("Complete a foundation lesson quiz to unlock review questions.");return;}
 setAdvancedLoading(true);
 try{const groups=await Promise.all(unlocked.map(entry=>advancedQuestionsForLesson(entry.index))),questions=shuffleList(groups.flat().filter(question=>missed.has(question.id))).slice(0,10).map(prepareAdvancedQuestion);if(!questions.length){toast("Your missed questions are not in the currently unlocked topics.");return;}beginAdvancedSession(questions,"weak",null,"Weak-Area Review");}
 catch(error){console.error(error);toast("Review questions could not load. Please try again.");}
 finally{setAdvancedLoading(false);}
}

function beginAdvancedSession(questions,mode,lessonIndex,label){
 advancedSession={questions,index:0,score:0,mode,lessonIndex,label,answered:false};openPage("advancedQuiz");renderAdvancedQuestion();
}

function renderAdvancedQuestion(){
 const question=advancedSession.questions[advancedSession.index];if(!question){finishAdvancedSession();return;}
 advancedSession.answered=false;
 document.getElementById("advancedQnum").textContent=advancedSession.index+1;document.getElementById("advancedQtotal").textContent=advancedSession.questions.length;document.getElementById("advancedQtext").textContent=question.question;
 const meta=document.getElementById("advancedMeta");meta.innerHTML="";[question.domain,question.ageGroup,question.system,"Advanced"].filter(Boolean).forEach(value=>{const badge=document.createElement("span");badge.textContent=value;meta.appendChild(badge);});
 const options=document.getElementById("advancedOptions");options.innerHTML="";question.answers.forEach((answer,index)=>{const button=document.createElement("button");button.className="option";button.textContent=String.fromCharCode(65+index)+". "+answer.text;button.onclick=()=>answerAdvancedQuestion(button,index);options.appendChild(button);});
 document.getElementById("advancedExplain").style.display="none";document.getElementById("advancedExplain").innerHTML="";document.getElementById("advancedNext").style.display="none";
}

function answerAdvancedQuestion(button,index){
 if(advancedSession.answered)return;advancedSession.answered=true;
 const question=advancedSession.questions[advancedSession.index],selected=question.answers[index],correct=selected.correct,buttons=[...document.querySelectorAll("#advancedOptions .option")];
 buttons.forEach((option,answerIndex)=>{option.disabled=true;if(question.answers[answerIndex].correct)option.classList.add("correct");});if(!correct)button.classList.add("wrong");
 if(correct)advancedSession.score++;
 recordAdvancedAnswer(question,correct);
 renderAdvancedExplanation(question,index,correct);
 document.getElementById("advancedNext").style.display="inline-block";
}

function recordAdvancedAnswer(question,correct){
 const progress=advancedProgressState(),domain=question.domain||"Other";progress.answered++;if(correct)progress.correct++;
 if(!progress.domains[domain])progress.domains[domain]={answered:0,correct:0};progress.domains[domain].answered++;if(correct)progress.domains[domain].correct++;
 const missed=new Set(progress.missedQuestionIds);if(correct)missed.delete(question.id);else{missed.add(question.id);state.mistakes.push({mode:"advanced",questionId:question.id,topic:question.lessonTitle,q:question.question,correct:question.answers.find(answer=>answer.correct).text,why:question.explanation,domain});}progress.missedQuestionIds=[...missed];save();
}

function appendAdvancedText(parent,tag,text,className){const element=document.createElement(tag);if(className)element.className=className;element.textContent=text;parent.appendChild(element);return element;}

function renderAdvancedExplanation(question,selectedIndex,correct){
 const box=document.getElementById("advancedExplain");box.innerHTML="";box.style.display="block";
 appendAdvancedText(box,"div",correct?"✅ Correct — strong clinical reasoning.":"❌ Not the best answer.","advanced-feedback");appendAdvancedText(box,"p",question.explanation,"advanced-summary");
 question.answers.forEach((answer,index)=>{const item=document.createElement("div");item.className="advanced-rationale"+(answer.correct?" correct":index===selectedIndex?" selected-wrong":"");appendAdvancedText(item,"b",String.fromCharCode(65+index)+". "+answer.text);appendAdvancedText(item,"span",answer.rationale);box.appendChild(item);});
 if(question.sources?.length){const sources=document.createElement("div");sources.className="advanced-sources";appendAdvancedText(sources,"b","Content review sources");question.sources.forEach(source=>{if(!/^https:\/\//.test(source.url||""))return;const link=document.createElement("a");link.href=source.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent=source.title+" ↗";sources.appendChild(link);});box.appendChild(sources);}
}

function nextAdvancedQuestion(){if(!advancedSession.answered)return;if(advancedSession.index<advancedSession.questions.length-1){advancedSession.index++;renderAdvancedQuestion();window.scrollTo(0,0);}else finishAdvancedSession();}

function finishAdvancedSession(){
 const progress=advancedProgressState(),total=advancedSession.questions.length,score=advancedSession.score,percent=total?Math.round(score/total*100):0;progress.attempts++;progress.lastScore=score;progress.lastTotal=total;progress.lastMode=advancedSession.mode;if(advancedSession.mode==="lesson"&&Number.isInteger(advancedSession.lessonIndex)&&!progress.completedLessons.includes(advancedSession.lessonIndex)){progress.completedLessons.push(advancedSession.lessonIndex);progress.completedLessons.sort((a,b)=>a-b);}markStudyDay();save();
 if(typeof trackAnonymousEvent==="function")trackAnonymousEvent("advanced_practice_complete",advancedSession.mode==="lesson"?advancedSession.lessonIndex+1:null);
 document.getElementById("advancedResultScore").textContent=score;document.getElementById("advancedResultTotal").textContent=total;document.getElementById("advancedResultMessage").textContent=percent>=80?"Strong session. Review every rationale to consolidate the reasoning.":percent>=60?"Good foundation. Use the missed-question review to strengthen weak decisions.":"This set identified useful study targets. Review the rationales, then retry.";document.getElementById("advancedResultDetail").textContent=advancedSession.label+" · "+percent+"% accuracy. This educational score is not a prediction of certification-exam performance.";openPage("advancedResult");renderAdvancedHub();
}
