// Run against a local Vite server with Playwright (or PLAYWRIGHT_MODULE).
// All API data is mocked. NO_BROADCAST=1 tests storage-event presence.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
const context=await browser.newContext();
if(process.env.NO_BROADCAST)await context.addInitScript(()=>{delete window.BroadcastChannel});
const events=Array.from({length:6},(_,i)=>({id:i+1,title:`Event ${i+1}`,eventDate:'2099-09-17',startTime:'12:00',birthdayEntries:[]}));
events.push({id:7,eventType:'BIRTHDAY_LIST',birthdayMonth:9,birthdayEntries:Array.from({length:10},(_,i)=>({name:`Person ${i+1}`,month:9,day:i+1}))});
await context.route(`http://${new URL(process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178').hostname}:8080/**`,r=>r.fulfill({json:r.request().url().endsWith('/events')?events:[]}));
const operator=await context.newPage();await operator.goto((process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178'));await operator.getByRole('button',{name:/Upcoming Events/}).click();
const send=operator.getByRole('button',{name:'Send to Projector',exact:true});
const popup=context.waitForEvent('page');
await send.evaluate(button=>{button.click();button.click();button.click()});
let projector=await popup;await projector.waitForLoadState();await projector.getByText('Event 1',{exact:true}).waitFor();
assert.equal(context.pages().length,2);console.log('PASS auto open, readiness, rapid clicks create one window');
await send.click();await send.waitFor();assert.equal(context.pages().length,2);console.log('PASS connected window reused');
await projector.close();const reopen=context.waitForEvent('page');await send.click();projector=await reopen;await projector.getByText('Event 1',{exact:true}).waitFor();assert.equal(context.pages().length,2);console.log('PASS closed window reopened');
await operator.locator('.header-right select').selectOption('7');await send.click();await projector.getByText('Person 1',{exact:true}).waitFor();assert.equal(context.pages().length,2);console.log('PASS birthday sends reuse window');
await projector.close();const birthdayPopup=context.waitForEvent('page');await send.click();projector=await birthdayPopup;await projector.getByText('Person 1',{exact:true}).waitFor();console.log('PASS birthday auto open');
// Delay PONG replies inside a live projector; the retry must reuse it.
if (!process.env.NO_BROADCAST) {
 await projector.evaluate(()=>{
  const original=BroadcastChannel.prototype.postMessage;
  BroadcastChannel.prototype.postMessage=function(message){
   if(message.type==='PROJECTOR_PONG')setTimeout(()=>original.call(this,message),300);
   else original.call(this,message);
  };
 });
 await send.click();await send.waitFor();assert.equal(context.pages().length,2);console.log('PASS slow PONG reuses connected window');
}
// Another independently opened projector must also be detected.
await projector.close();projector=await context.newPage();await projector.goto(`${process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178'}/?projector=1`);await projector.waitForTimeout(400);assert.equal(await projector.locator('.projector-screen').innerText(),'');await send.click();await projector.getByText('Person 1',{exact:true}).waitFor();await send.waitFor();assert.equal(context.pages().length,2);console.log('PASS independently opened projector detected');
await projector.close();
const before=await operator.evaluate(()=>localStorage.getItem('church-song-projector-state'));
await operator.evaluate(()=>{window.open=()=>null});await send.click();await send.waitFor();await operator.getByText('Projector window could not be opened. Click Connect Projector.',{exact:true}).waitFor();assert.equal(await operator.evaluate(()=>localStorage.getItem('church-song-projector-state')),before);assert.equal(context.pages().length,1);console.log('PASS blocked popup preserves live snapshot and displays message');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
