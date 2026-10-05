// Run with a local Vite server and Playwright (or PLAYWRIGHT_MODULE).
// Settings are persisted in an isolated mock API, never in user data.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
const context=await browser.newContext();let delay=0;
let settings={churchName:'Test Church',churchAbbreviation:'TC',defaultLanguage:'ENGLISH',defaultBackground:'sky-field',defaultServiceType:'Sunday Morning'};
let saves=0;
const song={id:1,title:'Test Song',language:'ENGLISH',lyrics:'[Verse 1]\nTest song line',type:'SLOW'};
await context.route(`http://${new URL(process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178').hostname}:8080/**`,async r=>{const p=new URL(r.request().url()).pathname;if(p==='/settings'){if(r.request().method()==='PUT'){settings=r.request().postDataJSON();saves++}else if(delay)await new Promise(resolve=>setTimeout(resolve,delay));return r.fulfill({json:settings})}if(p==='/songs')return r.fulfill({json:[song]});if(p==='/playlists')return r.fulfill({json:[{id:1,name:'Test Playlist',songs:[song]}]});if(p.includes('melody-reference'))return r.fulfill({status:204});return r.fulfill({json:[]})});
const operator=await context.newPage();await operator.goto((process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178'));
const getLive=()=>operator.evaluate(()=>JSON.parse(localStorage.getItem('church-song-projector-state')));
async function saveBackground(id){await operator.getByRole('button',{name:/Settings/,exact:false}).first().click();await operator.locator('select[name="defaultBackground"]').selectOption(id);await operator.getByRole('button',{name:'Save Settings',exact:true}).click();await operator.getByText('Settings saved successfully.',{exact:true}).waitFor();await operator.waitForFunction(id=>JSON.parse(localStorage.getItem('church-song-projector-state')).backgroundVariant===id,id)}
async function blank(page){assert.equal(await page.locator('.screen-content').count(),0);assert.equal(await page.locator('.projector-screen').innerText(),'')}
async function matches(page,id){await page.waitForFunction(id=>document.querySelector('.projector-screen')?.classList.contains('projector-screen-'+id),id)}
await saveBackground('deep-blue');assert.equal(settings.defaultBackground,'deep-blue');
const projector=await context.newPage();await projector.goto(`${process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178'}/?projector=1`);await matches(projector,'deep-blue');await blank(projector);
delay=700;await operator.reload();await operator.waitForTimeout(900);assert.equal((await getLive()).backgroundVariant,'deep-blue');await projector.reload();await matches(projector,'deep-blue');await blank(projector);await operator.getByRole('button',{name:/Settings/}).first().click();assert.equal(await operator.locator('select[name="defaultBackground"]').inputValue(),'deep-blue');console.log('PASS Deep Blue settings save and both refreshes');
await saveBackground('sunrise');await matches(projector,'sunrise');await operator.reload();await projector.reload();await operator.waitForTimeout(900);assert.equal((await getLive()).backgroundVariant,'sunrise');await matches(projector,'sunrise');await blank(projector);console.log('PASS changed background persists on both windows');
// API setting wins over a stale content-bearing projector cache.
await projector.close();await operator.close();
const bootstrap=await context.newPage();await bootstrap.goto(`${process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178'}/?projector=1`);
for(const type of ['SONG','BIBLE','EVENT','BIRTHDAY_LIST']){
 const state={projectionContentType:type==='BIRTHDAY_LIST'?'EVENT':type,projectionMode:'LIVE',backgroundType:'preset',backgroundVariant:'deep-blue',projectionSong:type==='SONG'?song:null,projectedBiblePassage:type==='BIBLE'?{bookKey:'JOHN',chapter:1,reference:'John 1',projectionMode:'FRENCH',verses:[{verseNumber:1,text:'Bible text'}]}:null,projectedEvents:type==='EVENT'?[{id:2,title:'Event',eventDate:'2099-09-17',startTime:'12:00'}]:type==='BIRTHDAY_LIST'?[{id:3,eventType:'BIRTHDAY_LIST',birthdayMonth:9,birthdayEntries:[{name:'Person',month:9,day:1}]}]:[]};state.projectedEvent=state.projectedEvents[0]||null;
 await bootstrap.evaluate(state=>localStorage.setItem('church-song-projector-state',JSON.stringify(state)),state);await bootstrap.reload();await matches(bootstrap,'sunrise');await blank(bootstrap);console.log('PASS saved API background wins stale cache for',type);
}
// Reopening preserves appearance but cannot restore cached live content.
await blank(bootstrap);
const reopenedOperator=await context.newPage();await reopenedOperator.goto(process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178');
await reopenedOperator.waitForFunction(()=>JSON.parse(localStorage.getItem('church-song-projector-state')).backgroundVariant==='sunrise');
await reopenedOperator.getByRole('button',{name:/Settings/}).first().click();
assert.equal(await reopenedOperator.locator('select[name="defaultBackground"]').inputValue(),'sunrise');
// A real operator Send Live is required, including after projector refresh.
await reopenedOperator.locator('nav.side-nav').getByRole('button',{name:/Worship Console/}).click();
await reopenedOperator.locator('.playlist-select').selectOption('1');
async function sendSong(){await reopenedOperator.locator('.right-console .current-heading h3').click();await reopenedOperator.keyboard.press('Enter');await bootstrap.getByText('Test song line',{exact:true}).waitFor();await matches(bootstrap,'sunrise')}
await sendSong();
await bootstrap.reload();await matches(bootstrap,'sunrise');await blank(bootstrap);
await sendSong();
console.log('PASS live content requires fresh explicit Send Live after refresh');
assert.equal(saves,2);console.log('PASS operator close/reopen; no unintended Settings writes');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
