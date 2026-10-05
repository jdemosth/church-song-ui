// Run against a local Vite server with Playwright (or PLAYWRIGHT_MODULE).
// API fixtures isolate all keyboard tests from saved application data.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
const context=await browser.newContext();if(process.env.NO_BROADCAST)await context.addInitScript(()=>{delete window.BroadcastChannel});const errors=[];
const songs=[1,2].map(id=>({id,title:`Song ${id}`,language:'ENGLISH',lyrics:`[Verse 1]\nSong ${id} first section\n[Verse 2]\nSong ${id} second section\n[Verse 3]\nSong ${id} third section`,type:'SLOW'}));
const playlists=songs.map((song,i)=>({id:i+1,name:`Playlist ${i+1}`,songs:[song],reusable:true}));
const events=Array.from({length:6},(_,i)=>({id:i+1,title:`Event ${i+1}`,eventDate:'2099-09-17',startTime:'12:00',birthdayEntries:[]}));events.push({id:7,eventType:'BIRTHDAY_LIST',birthdayMonth:9,birthdayEntries:Array.from({length:10},(_,i)=>({name:`Person ${i+1}`,month:9,day:i+1}))});
await context.route(`http://${new URL(process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178').hostname}:8080/**`,async r=>{
 const url=new URL(r.request().url()),p=url.pathname;let data=[];
 if(p==='/events')data=events;
 else if(p==='/songs')data=songs;
 else if(p==='/playlists')data=playlists;
 else if(p.includes('melody-reference'))return r.fulfill({status:204});
 else if(p==='/bible/translations')data=[{code:'LSG1910',name:'French'},{code:'KJV',name:'English'}];
 else if(p==='/bible/books')data=[{key:'JOHN',name:'John',chapterCount:2}];
 else if(p.includes('/metadata'))data={bookKey:'JOHN',chapter:Number(p.split('/')[5]),availableVerseNumbers:[1,2,3]};
 else if(p==='/bible/passage')data={bookKey:'JOHN',bookName:'John',chapter:Number(url.searchParams.get('chapter')),startVerse:1,endVerse:3,translationCode:url.searchParams.get('translation'),verses:[1,2,3].map(verseNumber=>({verseNumber,text:`Bible verse ${verseNumber}`}))};
 return r.fulfill({json:data});
});
const operator=await context.newPage();operator.on('pageerror',e=>errors.push(e.message));await operator.goto((process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178'));
const projector=await context.newPage();projector.on('pageerror',e=>errors.push(e.message));await projector.goto(`${process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178'}/?projector=1`);
const live=()=>operator.evaluate(()=>JSON.parse(localStorage.getItem('church-song-projector-state')));
async function blank() {await projector.waitForTimeout(450);assert.equal(await projector.locator('.projector-screen').innerText(),'')}
async function reloadBlank() {await projector.reload();await blank()}
async function sendEvents(text) {await operator.getByRole('button',{name:'Send to Projector',exact:true}).click();await projector.getByText(text,{exact:true}).waitFor()}
await blank();
await operator.getByRole('button',{name:/Upcoming Events/}).click();await blank();
await sendEvents('Event 1');await reloadBlank();
await operator.locator('.event-card h3').first().click();await operator.keyboard.press('ArrowRight');await blank();
await sendEvents('Event 1');
await operator.locator('.header-right select').selectOption('7');await sendEvents('Person 1');await reloadBlank();await sendEvents('Person 1');
await operator.getByRole('button',{name:/Worship Console/}).click();await operator.locator('.playlist-select').selectOption('1');await operator.locator('.right-console .current-heading h3').click();await operator.keyboard.press('Enter');await projector.getByText('Song 1 first section',{exact:true}).waitFor();
await reloadBlank();await operator.keyboard.press('Enter');await projector.getByText('Song 1 first section',{exact:true}).waitFor();
await operator.keyboard.press('b');await projector.waitForTimeout(100);assert.equal(await projector.locator('.projector-screen.black').count(),1);await operator.keyboard.press('b');await projector.getByText('Song 1 first section',{exact:true}).waitFor();
await operator.getByRole('button',{name:'Bible',exact:true}).click();await operator.getByRole('button',{name:'Preview Passage',exact:true}).click();await operator.locator('.bible-console-verse').first().waitFor();await operator.locator('.right-console .current-heading h3').click();await operator.keyboard.press('Enter');await projector.getByText('Bible verse 1',{exact:false}).first().waitFor();
await reloadBlank();await operator.keyboard.press('Enter');await projector.getByText('Bible verse 1',{exact:false}).first().waitFor();
// RC3 Test 36: the public window stays mounted while ONLY the operator reloads.
const openEvents=()=>operator.locator('nav.side-nav').getByRole('button',{name:/Upcoming Events/}).click();
const openConsole=()=>operator.locator('nav.side-nav').getByRole('button',{name:/Worship Console/}).click();
async function prepareSong(id){await openConsole();await operator.getByRole('button',{name:'Song',exact:true}).click();await operator.locator('.playlist-select').selectOption(String(id));await operator.locator('.right-console .current-heading h3').click()}
async function prepareBible(){await openConsole();await operator.getByRole('button',{name:'Bible',exact:true}).click();await operator.getByRole('button',{name:'Preview Passage',exact:true}).click();await operator.locator('.bible-console-verse').first().waitFor();await operator.locator('.right-console .current-heading h3').click()}
async function sameLive(text){await projector.waitForTimeout(450);assert.equal(await projector.locator('.projector-screen').innerText(),text)}
for(const kind of ['Events','Birthdays','Songs','Bible']){
 if(kind==='Events'||kind==='Birthdays'){await openEvents();await operator.locator('.header-right select').selectOption(kind==='Events'?'upcoming':'7');await sendEvents(kind==='Events'?'Event 1':'Person 1')}
 else {if(kind==='Songs')await prepareSong(1);else await prepareBible();await operator.keyboard.press('Enter');await projector.getByText(kind==='Songs'?'Song 1 first section':'Bible verse 1',{exact:false}).first().waitFor()}
 const before=await projector.locator('.projector-screen').innerText();
 const documentId=await projector.evaluate(()=>window.continuityDocumentId=crypto.randomUUID());
 await operator.reload();await sameLive(before);
 if(kind==='Events'||kind==='Birthdays'){
  await openEvents();await operator.locator('.header-right select').selectOption(kind==='Events'?'7':'upcoming');await operator.locator('.event-card h3').first().click();await operator.keyboard.press('ArrowRight');await sameLive(before);
  await sendEvents(kind==='Events'?'Person 1':'Event 1');
 }else{
  await prepareSong(2);await operator.keyboard.press('ArrowRight');await sameLive(before);
  // Explicit display controls still work before the reloaded operator's first send.
  await operator.keyboard.press('b');await projector.waitForTimeout(150);assert.equal(await projector.locator('.projector-screen.black').count(),1);
  await operator.keyboard.press('b');await sameLive(before);
  await operator.keyboard.press('c');await blank();await operator.keyboard.press('c');await sameLive(before);
  await operator.keyboard.press('Enter');await projector.getByText('Song 2 second section',{exact:true}).waitFor();
 }
 assert.equal(await projector.evaluate(()=>window.continuityDocumentId),documentId);
 await reloadBlank();
 if(kind==='Events'||kind==='Birthdays')await sendEvents(kind==='Events'?'Person 1':'Event 1');
 else {await operator.keyboard.press('Enter');await projector.getByText('Song 2 second section',{exact:true}).waitFor()}
 console.log('PASS operator refresh continuity, preparation isolation, explicit replacement and projector refresh safety:',kind);
}
// With a reconnecting operator, display-only controls cannot reveal cached content
// in a projector that has itself just refreshed.
await operator.reload();await reloadBlank();await prepareSong(1);
for(const key of ['b','b','c','c']){await operator.keyboard.press(key);await blank()}
await operator.keyboard.press('Enter');await projector.getByText('Song 1 first section',{exact:true}).waitFor();
console.log('PASS reconnect display controls cannot reveal cached content after projector refresh');
assert.deepEqual(errors,[]);console.log('PASS blank opening/refresh, no admin/page activation, explicit Events/Birthdays/Songs/Bible resend and Black Screen');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
