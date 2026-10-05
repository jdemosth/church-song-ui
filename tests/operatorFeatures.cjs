const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const scenarios = require('./operatorFeatureScenarios.cjs');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try {
  const context=await browser.newContext();
  if(process.env.NO_BROADCAST) await context.addInitScript(()=>{delete window.BroadcastChannel});
  const ui=process.env.EVENTS_TEST_URL||'http://127.0.0.1:5188';
  const songs=[{id:1,title:'Song 1',language:'ENGLISH',songType:'SLOW',lyrics:'[Verse 1]\nSong 1 first section\n[Verse 2]\nSong 1 second section'}];
  await context.route(`http://${new URL(ui).hostname}:8080/**`,async r=>{
   const u=new URL(r.request().url()),p=u.pathname;let data=[];
   if(p==='/projector/capabilities')return r.fulfill({status:404,json:{}});
   if(p==='/songs')data=songs;
   if(p==='/playlists')data=[{id:1,name:'Sunday',songs,reusable:true}];
   if(p==='/settings')data={churchName:'HMGA',defaultLanguage:'ENGLISH',defaultBackground:'deep-blue'};
   if(p==='/events')data=Array.from({length:10},(_,i)=>({id:i+1,title:'Event '+(i+1),eventDate:'2099-09-17',startTime:'12:00',birthdayEntries:[]}));
   if(p==='/bible/translations')data=[{code:'LSG1910',name:'French'},{code:'KJV',name:'English'}];
   if(p==='/bible/books')data=[{key:'JOHN',name:'John',chapterCount:3}];
   if(p.endsWith('/metadata'))data={availableVerseNumbers:[1,2,3]};
   if(p==='/bible/passage')data={bookKey:'JOHN',bookName:'John',chapter:1,startVerse:1,endVerse:3,translationCode:u.searchParams.get('translation'),verses:[1,2,3].map(verseNumber=>({verseNumber,text:`Bible verse ${verseNumber} ${u.searchParams.get('translation')}`}))};
   return r.fulfill({json:data});
  });
  const errors=[];context.on('page',p=>p.on('pageerror',error=>errors.push(error.message)));
  const page=await context.newPage();page.setDefaultTimeout(10000);await page.goto(ui);
  const projector=await context.newPage();await projector.goto(ui+'/?projector=1');
  await scenarios(page,projector);
  assert.deepEqual(errors,[],'no browser runtime errors in feature scenarios');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
