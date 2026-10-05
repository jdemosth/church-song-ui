// Run against a local Vite server. API requests are mocked; no saved data is changed.
// PLAYWRIGHT_MODULE may point to an existing Playwright installation.
// NO_BROADCAST=1 exercises storage-only sync using operator Left/Right page navigation.
// Operator Up/Down selects cards; the public projector retains Up/Down page navigation.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true}); try {
const context=await browser.newContext();
if (process.env.NO_BROADCAST) await context.addInitScript(() => { delete window.BroadcastChannel; });
let events=Array.from({length:4},(_,i)=>({id:i+1,title:`Event ${i+1}`,eventDate:'2099-11-12',startTime:'12:00',birthdayEntries:[]}));
let delay=0;
await context.route(`http://${new URL(process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178').hostname}:8080/**`,async route=>{
 const req=route.request(), url=new URL(req.url());
 if(url.pathname.startsWith('/events')) {
 if(req.method()==='POST')events.push({...req.postDataJSON(),id:events.length+1});
 if(req.method()==='PUT')events=events.map(e=>e.id===Number(url.pathname.split('/').pop())?{...req.postDataJSON(),id:e.id}:e);
 if(req.method()==='DELETE')events=events.filter(e=>e.id!==Number(url.pathname.split('/').pop()));
 if(req.method()==='GET'&&delay)await new Promise(r=>setTimeout(r,delay));
 return route.fulfill({json:req.method()==='GET'?events:events.at(-1)});
 }
 return route.fulfill({json:[]});
});
const operator=await context.newPage();operator.on('pageerror',e=>console.log('OPERATOR ERROR',e.message));
await operator.goto((process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178'));
await operator.getByRole('button',{name:/Upcoming Events/}).click();
const projector=await context.newPage();projector.on('pageerror',e=>console.log('PROJECTOR ERROR',e.message));await projector.goto(`${process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178'}/?projector=1`);
const send=operator.getByRole('button',{name:'Send to Projector',exact:true});
const live=()=>operator.evaluate(()=>JSON.parse(localStorage.getItem('church-song-projector-state')));
await send.click();await projector.locator('.event-projection-item').first().waitFor(); assert.equal((await live()).projectedEvents.length,4); console.log('PASS initial 4');
async function add(n){await operator.getByRole('button',{name:'+ Add Event',exact:true}).click();await operator.getByLabel('Title *',{exact:true}).fill(`Event ${n}`);await operator.getByLabel('Start Date *',{exact:true}).fill('2099-11-12');await operator.getByLabel('Start Time *',{exact:true}).fill('12:00');await operator.getByRole('button',{name:'Add Event',exact:true}).click();await operator.locator('.modal-overlay').waitFor({state:'hidden'});}
await add(5);await operator.locator('.event-card').nth(4).waitFor();await send.click();await send.waitFor();assert.equal((await live()).projectedEvents.length,5);console.log('PASS normal fifth save/send');
delay=1500;await add(6);await send.click();await send.waitFor();assert.equal((await live()).projectedEvents.length,6);console.log('PASS sixth immediate save/send includes all six');delay=0;
await operator.locator('.event-card').nth(1).getByRole('button',{name:'Edit',exact:true}).click();
await operator.getByLabel('Title *',{exact:true}).fill('Edited Event 2');
await operator.getByRole('button',{name:'Save Event',exact:true}).click();
await operator.locator('.modal-overlay').waitFor({state:'hidden'});
assert.equal((await live()).projectedEvents[1].title,'Event 2');
assert(!(await projector.locator('.screen-content-event').innerText()).includes('Edited Event 2'));
await send.click();await send.waitFor();await projector.getByText('Edited Event 2',{exact:true}).waitFor();console.log('PASS edit isolation and explicit refresh');
await (process.env.NO_BROADCAST ? operator : projector).keyboard.press(process.env.NO_BROADCAST ? 'ArrowRight' : 'ArrowDown');await projector.getByText('Event 5',{exact:true}).waitFor();assert.equal(await projector.locator('.event-projection-item').count(),2);
await (process.env.NO_BROADCAST ? operator : projector).keyboard.press(process.env.NO_BROADCAST ? 'ArrowLeft' : 'ArrowUp');await projector.getByText('Event 1',{exact:true}).waitFor();assert.equal(await projector.locator('.event-projection-item').count(),4);console.log('PASS next 5-6 and previous 1-4');
await (process.env.NO_BROADCAST ? operator : projector).keyboard.press(process.env.NO_BROADCAST ? 'ArrowRight' : 'ArrowDown');await projector.getByText('Event 5',{exact:true}).waitFor();await send.click();await send.waitFor();await projector.getByText('Event 1',{exact:true}).waitFor();assert.equal((await live()).projectedEventPageIndex,0);console.log('PASS resend resets page');
operator.on('dialog',d=>d.accept());await operator.locator('.event-card').last().getByRole('button',{name:'Delete',exact:true}).click();
await operator.waitForFunction(()=>document.querySelectorAll('.event-card').length===5);assert.equal((await live()).projectedEvents.length,6);
await send.click();await send.waitFor();assert.equal((await live()).projectedEvents.length,5);console.log('PASS deletion requires send');
let version=(await live()).eventSnapshotVersion;
for(let i=0;i<3;i++){await send.click();await send.waitFor();const state=await live();assert(state.eventSnapshotVersion>version);version=state.eventSnapshotVersion;assert.equal(state.projectedEvents.length,5);}
console.log('PASS repeated sends create new versions');
// Prove BroadcastChannel still updates if localStorage writes fail.
if (!process.env.NO_BROADCAST) {
await operator.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError')}});
events[0]={...events[0],title:'Broadcast despite storage failure'};
await send.click();await send.waitFor();await projector.getByText('Broadcast despite storage failure',{exact:true}).waitFor();console.log('PASS broadcast survives storage failure');
}
await context.close();}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
