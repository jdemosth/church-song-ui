// Run against a local Vite server with Playwright (or PLAYWRIGHT_MODULE).
// API fixtures isolate all keyboard tests from saved application data.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
const context=await browser.newContext();const errors=[];
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
async function key(key){await operator.evaluate(()=>document.activeElement?.blur());await operator.keyboard.press(key);await operator.waitForTimeout(100)}
await operator.getByRole('button',{name:/Upcoming Events/}).click();await operator.locator('.service-header h2').click();await operator.getByRole('button',{name:'Send to Projector',exact:true}).click();await projector.getByText('Event 1',{exact:true}).waitFor();
await key('ArrowLeft');assert.equal((await live()).projectedEventPageIndex,0);
await key('ArrowRight');await projector.getByText('Event 5',{exact:true}).waitFor();assert.equal((await live()).projectedEventPageIndex,1);
await key('ArrowRight');assert.equal((await live()).projectedEventPageIndex,1);await key('ArrowLeft');assert.equal((await live()).projectedEventPageIndex,0);console.log('PASS Events explicit send, Left/Right, boundaries');
await operator.locator('.header-right select').selectOption('7');await operator.getByRole('button',{name:'Send to Projector',exact:true}).click();await projector.getByText('Person 1',{exact:true}).waitFor();await key('ArrowLeft');assert.equal((await live()).projectedEventPageIndex,0);await key('ArrowRight');await projector.getByText('Person 9',{exact:true}).waitFor();await key('ArrowRight');assert.equal((await live()).projectedEventPageIndex,1);await key('ArrowLeft');assert.equal((await live()).projectedEventPageIndex,0);
await operator.locator('.header-right select').selectOption('upcoming');await key('ArrowRight');assert.equal((await live()).projectedEvents[0].eventType,'BIRTHDAY_LIST');assert.equal((await live()).projectedEventPageIndex,0);assert((await operator.locator('.events-page-status').innerText()).includes('Page 2 of 2'));assert((await operator.locator('.events-page-status').innerText()).toUpperCase().includes('PREPARED'));console.log('PASS birthday paging and independent Events preparation');
await operator.locator('.event-card').first().getByRole('button',{name:'Edit',exact:true}).click();const before=JSON.stringify(await live());const input=operator.getByLabel('Title *',{exact:true});await input.focus();for(const k of ['ArrowDown','ArrowRight','b','Enter'])await operator.keyboard.press(k);assert.equal(JSON.stringify(await live()),before);await operator.locator('.modal-heading h2').click();await key('b');await key('Enter');assert.equal(JSON.stringify(await live()),before);await operator.getByRole('button',{name:'Cancel',exact:true}).click();await key('b');assert.equal((await live()).projectionMode,'BLACK');await key('b');assert.equal((await live()).projectionMode,'LIVE');console.log('PASS editing/modal safety and Black Screen');
await operator.getByRole('button',{name:/Worship Console/}).click();
await operator.locator('.playlist-select').selectOption('1');await operator.locator('.right-console .current-heading h3').click();const birthdayBefore=JSON.stringify(await live());await key('ArrowRight');assert.equal(JSON.stringify(await live()),birthdayBefore);assert((await operator.locator('.keyboard-status').innerText()).includes('Verse 2'));await key('Enter');await projector.getByText('Song 1 second section',{exact:true}).waitFor();await key('ArrowRight');assert.equal((await live()).sectionIndex,2);await key('ArrowRight');assert.equal((await live()).sectionIndex,2);await key('ArrowLeft');assert.equal((await live()).sectionIndex,1);await key('ArrowDown');assert.equal((await live()).sectionIndex,1);
await operator.locator('.playlist-select').selectOption('2');await operator.locator('.right-console .current-heading h3').click();assert.equal((await live()).projectionSong.id,1);await key('ArrowRight');assert.equal((await live()).projectionSong.id,1);await key('Enter');await projector.getByText('Song 2 second section',{exact:true}).waitFor();console.log('PASS Songs section keys, scrolling, playlist switch isolation and fresh callbacks');
await operator.getByRole('button',{name:'Bible',exact:true}).click();await operator.getByRole('button',{name:'Preview Passage',exact:true}).click();await operator.locator('.bible-console-verse').first().waitFor();
await key('ArrowRight');assert.equal((await live()).projectionContentType,'SONG');await key('Enter');await projector.getByText('Bible verse 2',{exact:false}).first().waitFor();assert.equal((await live()).projectedBibleVerseIndex,1);await key('ArrowDown');assert.equal((await live()).projectedBibleVerseIndex,2);await key('ArrowDown');assert.equal((await live()).projectedBibleVerseIndex,2);await key('ArrowLeft');assert.equal((await live()).projectedBibleVerseIndex,1);console.log('PASS Bible prepared/live arrow routing and bounds');
assert.equal(errors.length,0,errors.join('\n'));assert.equal(await projector.locator('.keyboard-status,.events-page-status').count(),0);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
