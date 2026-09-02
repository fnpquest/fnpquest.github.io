const CACHE_NAME="fnp-quest-v16.15-offline-1";
const SUPABASE_CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
const SHELL_URLS=[
 "./",
 "index.html",
 "manifest.webmanifest?v=16.15",
 "css/styles.css?v=16.15",
 "js/app.js?v=16.15",
 "js/progress.js?v=16.15",
 "js/supabase.js?v=16.15",
 "js/analytics.js?v=16.15",
 "js/auth.js?v=16.15",
 "js/lessons.js?v=16.15",
 "js/quiz.js?v=16.15",
 "js/advanced-quiz.js?v=16.15",
 "js/version.js?v=16.15",
 "version.json",
 "data/curriculum.json",
 "assets/icons/favicon-v1-32.png",
 "assets/icons/apple-touch-icon-v1.png",
 "assets/icons/app-icon-v1-192.png",
 "assets/icons/app-icon-v1-512.png",
 "assets/icons/app-icon-v1-maskable-512.png",
 "daily-questions/index.html",
 "daily-questions/daily-questions.css",
 "daily-questions/daily-questions.js",
 "data/daily-questions.json",
 "data/site-config.json"
];

async function cacheRequired(cache,url){
 const response=await fetch(url,{cache:"reload"});
 if(!response.ok&&response.type!=="opaque")throw new Error("Offline file could not be cached: "+url);
 await cache.put(url,response);
}

async function cacheCurriculumFiles(cache){
 const manifestResponse=await fetch("data/curriculum.json",{cache:"reload"});
 if(!manifestResponse.ok)throw new Error("Curriculum could not be cached");
 await cache.put("data/curriculum.json",manifestResponse.clone());
 const manifest=await manifestResponse.json();
 const urls=[...new Set((manifest.lessons||[]).flatMap(item=>[item.lessonFile,item.quizFile,item.advancedQuizFile]).filter(Boolean))];
 for(let index=0;index<urls.length;index+=24){
  await Promise.all(urls.slice(index,index+24).map(url=>cacheRequired(cache,url)));
 }
}

self.addEventListener("install",event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  await Promise.all(SHELL_URLS.map(url=>cacheRequired(cache,url)));
  await cacheRequired(cache,SUPABASE_CDN);
  await cacheCurriculumFiles(cache);
  await self.skipWaiting();
 })());
});

self.addEventListener("activate",event=>{
 event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith("fnp-quest-")&&name!==CACHE_NAME).map(name=>caches.delete(name)));
  await self.clients.claim();
 })());
});

async function networkFirst(request,fallback){
 const cache=await caches.open(CACHE_NAME);
 try{const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;}
 catch(error){return (await cache.match(request,{ignoreSearch:true}))||(fallback?cache.match(fallback,{ignoreSearch:true}):Promise.reject(error));}
}

self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.hostname.endsWith("supabase.co")){event.respondWith(fetch(request));return;}
 if(request.mode==="navigate"){event.respondWith(networkFirst(request,"index.html"));return;}
 if(url.origin===self.location.origin&&url.pathname.endsWith("/version.json")){event.respondWith(networkFirst(request,"version.json"));return;}
 if(url.origin===self.location.origin||request.url===SUPABASE_CDN){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE_NAME);
   const cached=await cache.match(request,{ignoreSearch:false})||await cache.match(request,{ignoreSearch:true});
   if(cached)return cached;
   const response=await fetch(request);
   if(response.ok||response.type==="opaque")await cache.put(request,response.clone());
   return response;
  })());
 }
});
