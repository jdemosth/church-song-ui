// Run against a local Vite server with Playwright (or PLAYWRIGHT_MODULE).
// API fixtures isolate all keyboard tests from saved application data.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
const context=await browser.newContext();const errors=[];
const songs=Array.from({length:30},(_,i)=>i+1).map(id=>({id,title:`Song ${id}`,language:'ENGLISH',lyrics:`[Verse 1]\nSong ${id} first section\n[Verse 2]\nSong ${id} second section\n[Verse 3]\nSong ${id} third section`,type:'SLOW'}));
const playlists=[{id:1,name:"Working Service",songs:songs.slice(0,4),reusable:true}];
const writes=[];
playlists.push({...playlists[0],id:2,name:'Second Playlist'});
const events=Array.from({length:6},(_,i)=>({id:i+1,title:`Event ${i+1}`,eventDate:'2099-09-17',startTime:'12:00',birthdayEntries:[]}));events.push({id:7,eventType:'BIRTHDAY_LIST',birthdayMonth:9,birthdayEntries:Array.from({length:10},(_,i)=>({name:`Person ${i+1}`,month:9,day:i+1}))});
await context.route(`http://${new URL(process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178').hostname}:8080/**`,async r=>{
 const url=new URL(r.request().url()),p=url.pathname;let data=[];
 if(r.request().method() !== 'GET') { writes.push(p); if(p.startsWith('/playlists/id/1/songs/')) { const song=songs.find(s=>s.id===Number(p.split('/').at(-1))); if(!playlists[0].songs.some(s=>s.id===song.id)) playlists[0].songs.push(song); return r.fulfill({json:playlists[0]}); } }
 if(p==='/events')data=events;
 else if(p==='/service-plans')data=[1,2].map(id=>({id,serviceName:`Service ${id}`,serviceDate:'2026-09-01',status:'COMPLETED',songs:[]}));
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
for (const [name, selector] of [['Songs','.songs-management-grid .song-list'],['Playlists','.playlist-management-list'],['Service History','.service-history-list']]) {
 await operator.locator('.side-link').filter({hasText:name}).click();
 const list=operator.locator(selector).first();
 const rows=list.locator('.song-item,.playlist-management-item');
 await rows.first().click();
 const before=JSON.stringify(await live());
 await key('ArrowDown');
 assert.match(await rows.nth(1).getAttribute('class'),/selected|active/,name);
 assert.equal(await operator.locator('.side-link[data-keyboard-highlight="true"]').count(),0);
 await key('Enter');assert.match(await rows.nth(1).getAttribute('class'),/selected|active/);
 await key('ArrowUp');await key('ArrowUp');assert.match(await rows.first().getAttribute('class'),/selected|active/);
 assert.equal(JSON.stringify(await live()),before);
 if(name==='Songs') {const input=operator.getByPlaceholder('Search title or author...');await input.click();await key('ArrowDown');assert.match(await rows.first().getAttribute('class'),/selected/);}
 console.log(`PASS ${name}: focus handoff, selection, Enter, boundaries, live unchanged`);
}
await operator.locator('.side-link').filter({hasText:'Upcoming Events'}).click();await operator.getByRole('button',{name:'Send to Projector',exact:true}).click();await projector.getByText('Event 1',{exact:true}).waitFor();console.log('Projector Events received');
await projector.keyboard.press('ArrowDown');await projector.getByText('Event 5',{exact:true}).waitFor();await projector.keyboard.press('ArrowUp');await projector.getByText('Event 1',{exact:true}).waitFor();
assert.deepEqual(errors,[]);console.log('PASS separate projector window keyboard navigation');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
