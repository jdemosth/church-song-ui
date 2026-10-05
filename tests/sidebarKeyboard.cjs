// Run against a local Vite server with Playwright (or PLAYWRIGHT_MODULE).
// API fixtures isolate all keyboard tests from saved application data.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
const context=await browser.newContext();const errors=[];
const songs=Array.from({length:30},(_,i)=>i+1).map(id=>({id,title:`Song ${id}`,language:'ENGLISH',lyrics:`[Verse 1]\nSong ${id} first section\n[Verse 2]\nSong ${id} second section\n[Verse 3]\nSong ${id} third section`,type:'SLOW'}));
const playlists=[{id:1,name:"Working Service",songs:songs.slice(0,4),reusable:true}];
const writes=[];
const events=Array.from({length:6},(_,i)=>({id:i+1,title:`Event ${i+1}`,eventDate:'2099-09-17',startTime:'12:00',birthdayEntries:[]}));events.push({id:7,eventType:'BIRTHDAY_LIST',birthdayMonth:9,birthdayEntries:Array.from({length:10},(_,i)=>({name:`Person ${i+1}`,month:9,day:i+1}))});
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
const links=operator.locator('.side-link');
const current=()=>operator.locator('.side-link.active').innerText();
const highlighted=()=>operator.locator('.side-link[data-keyboard-highlight="true"]').innerText();
await links.filter({hasText:'Songs'}).click();
await key('ArrowDown'); assert.match(await highlighted(),/Upcoming Events/);assert.match(await current(),/Songs/);
await key('ArrowDown');assert.match(await highlighted(),/Playlists/);assert.match(await current(),/Songs/);
await key('ArrowUp');assert.match(await highlighted(),/Upcoming Events/);
await key('Enter');assert.match(await current(),/Upcoming Events/);
await key('ArrowDown');assert.match(await highlighted(),/Playlists/);assert.match(await current(),/Upcoming Events/);
await key('Enter');assert.match(await current(),/Playlists/);
await links.first().click();await key('ArrowUp');assert.match(await highlighted(),/Worship Console/);
await links.last().click();await key('ArrowDown');assert.match(await highlighted(),/Settings/);
await links.filter({hasText:'Upcoming Events'}).click();
await operator.locator('main').click({position:{x:5,y:5}});await key('ArrowRight');
assert.match(await operator.locator('.events-page-status').innerText(),/Page 2 of 2/);
assert.equal(await operator.locator('.side-link[data-keyboard-highlight="true"]').count(),0);
await operator.getByRole('button',{name:'Send to Projector',exact:true}).click();await projector.getByText('Event 1',{exact:true}).waitFor();await key('ArrowRight');assert.equal((await live()).projectedEventPageIndex,1);
await links.first().click();
await operator.locator('.library-card .card-header h3').click();await key('ArrowDown');assert.equal(await operator.locator('.library-card .selected').count(),1);
await operator.locator('.service-card .card-header h3').click();await key('ArrowDown');assert.equal(await operator.locator('.keyboard-song-highlight').count(),1);
await operator.locator('.right-console .current-heading h3').click();await key('ArrowRight');assert.match(await operator.locator('.keyboard-status').innerText(),/Verse 2/);
assert.deepEqual(errors,[]);
console.log('PASS sidebar highlight versus route, Enter, mouse activation, boundaries, Events and console panel routing');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
