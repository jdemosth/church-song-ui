// Run against a local Vite server with Playwright (or PLAYWRIGHT_MODULE).
// API fixtures isolate all keyboard tests from saved application data.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
const context=await browser.newContext();const errors=[];
const songs=Array.from({length:30},(_,i)=>i+1).map(id=>({id,title:`Song ${id}`,language:'ENGLISH',lyrics:`[Verse 1]\nSong ${id} first section\n[Verse 2]\nSong ${id} second section\n[Verse 3]\nSong ${id} third section`,type:'SLOW'}));
const playlists=[{id:1,name:"Working Service",songs:songs.slice(0,4),reusable:true}];
const writes=[];
const events=Array.from({length:10},(_,i)=>({id:i+1,title:`Event ${i+1}`,eventDate:'2099-09-17',startTime:'12:00',birthdayEntries:[]}));events.push({id:11,eventType:'BIRTHDAY_LIST',birthdayMonth:9,birthdayEntries:Array.from({length:10},(_,i)=>({name:`Person ${i+1}`,month:9,day:i+1}))});
events.unshift(events.pop());
await context.route(`http://${new URL(process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178').hostname}:8080/**`,async r=>{
 const url=new URL(r.request().url()),p=url.pathname;let data=[];
 if(r.request().method() !== 'GET') { writes.push(p); if(p.startsWith('/playlists/id/1/songs/')) { const song=songs.find(s=>s.id===Number(p.split('/').at(-1))); if(!playlists[0].songs.some(s=>s.id===song.id)) playlists[0].songs.push(song); return r.fulfill({json:playlists[0]}); } }
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
async function key(k) { await operator.keyboard.press(k); await operator.waitForTimeout(100) }
await operator.getByRole('button',{name:/Upcoming Events/}).click();
await operator.locator('.event-card').first().click();
assert.equal(await operator.locator('main').getAttribute('data-keyboard-panel'),'EVENTS_LIST');
const liveBefore=JSON.stringify(await live());
await key('ArrowDown');assert.equal(await operator.locator('.keyboard-event-highlight').getAttribute('data-keyboard-event'),'1');
await key('ArrowDown');assert.equal(await operator.locator('.keyboard-event-highlight').getAttribute('data-keyboard-event'),'2');
await key('ArrowUp');assert.equal(await operator.locator('.keyboard-event-highlight').getAttribute('data-keyboard-event'),'1');
assert.equal(JSON.stringify(await live()),liveBefore);
await key('Enter');await operator.getByLabel('Title *',{exact:true}).waitFor();
assert.equal(await operator.getByLabel('Title *',{exact:true}).inputValue(),'Event 1');
await key('ArrowRight');assert.equal(JSON.stringify(await live()),liveBefore);
await operator.getByRole('button',{name:'Cancel',exact:true}).click();
await key('ArrowRight');assert.match(await operator.locator('.events-page-status').innerText(),/Page 2 of 3/);
await key('ArrowRight');await key('ArrowRight');assert.match(await operator.locator('.events-page-status').innerText(),/Page 3 of 3/);
await key('ArrowLeft');assert.match(await operator.locator('.events-page-status').innerText(),/Page 2 of 3/);
assert.equal(JSON.stringify(await live()),liveBefore);
await operator.getByRole('button',{name:'Send to Projector',exact:true}).click();await projector.getByText('Event 1',{exact:true}).waitFor();
await key('ArrowRight');await key('ArrowRight');await key('ArrowRight');assert.equal((await live()).projectedEventPageIndex,2);
await key('ArrowLeft');assert.equal((await live()).projectedEventPageIndex,1);
await key('ArrowDown');assert.equal((await live()).projectedEventPageIndex,1);
const select=operator.locator('.header-right select');await select.focus();await select.dispatchEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true});assert.equal((await live()).projectedEventPageIndex,1);
await operator.locator('.event-card').first().click();await key('Enter');await operator.getByRole('button',{name:'Cancel',exact:true}).click();
await operator.getByRole('button',{name:/Songs/,exact:false}).filter({has:operator.locator('.nav-icon')}).click();await key('ArrowDown');assert.match(await operator.locator('.side-link[data-keyboard-highlight="true"]').innerText(),/Upcoming Events/);
assert.deepEqual(errors,[]);console.log('PASS Events card order/edit, independent 3-page prepared/live navigation, boundaries, controls and sidebar');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
