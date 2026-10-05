// Run with a local Vite server and Playwright. All test data is isolated.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
const context=await browser.newContext({viewport:{width:1280,height:720}});await context.route(`http://${new URL(process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178').hostname}:8080/**`,r=>r.fulfill({json:[]}));
const page=await context.newPage();await page.goto(`${process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178'}/?projector=1`);
await page.locator('.projector-screen').waitFor();
assert.equal(await page.locator('.screen-content').count(),0);
// Model each explicit operator send with fresh metadata; keep the startup gate enabled.
async function sendLive(state){await page.evaluate(state=>{const ch=new BroadcastChannel('church-song-projector');ch.postMessage({type:'sync-projector-state',payload:{...state,liveSend:{id:crypto.randomUUID(),issuedAt:Date.now()}}});ch.close()},state)}
await page.evaluate(async()=>{
 const {saveBackgroundImage}=await import('/src/backgroundStorage.js');
 for(const [id,color] of [['black','#000000'],['white','#ffffff'],['mixed',null]]){
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d');
  ctx.fillStyle=color||'#fff';ctx.fillRect(0,0,1280,720);if(!color){ctx.fillStyle='#000';ctx.fillRect(640,0,640,720)}
  const blob=await new Promise(r=>canvas.toBlob(r));await saveBackgroundImage({id,file:new File([blob],id+'.png',{type:'image/png'})});
 }
});
for(const [variant,theme] of [['deep-blue','light'],['sunrise','dark'],['sky-field','dark'],['black','light'],['white','dark'],['mixed','dark']]){
 const events=Array.from({length:4},(_,i)=>({id:i+1,title:'Annual Convention Miami',hostName:'Pastor John Smith',eventDate:'2026-09-14',endDate:'2026-09-16',startTime:'19:30',location:'7183 Vaca Key Way, Lake Worth FL 33467',titleColor:'#000000',detailsColor:'#000000',dateColor:'#8B3A8B'}));
 const custom=['black','white','mixed'].includes(variant);
 const state={projectionContentType:'EVENT',projectionMode:'LIVE',projectedEvents:events,projectedEvent:events[0],projectedEventPageIndex:0,backgroundType:custom?'custom':'preset',backgroundVariant:variant,customBackgroundId:custom?variant:null};
 await sendLive(state);
 await page.waitForFunction(theme=>document.querySelector('.projector-screen')?.dataset.eventTextTheme===theme,theme);
 if(custom)await page.waitForFunction(()=>document.querySelector('.projector-screen').style.backgroundImage.includes('blob:'));
 await page.waitForTimeout(150);
 await page.waitForFunction(theme=>document.querySelector('.projector-screen')?.dataset.eventTextTheme===theme,theme);
 const colors=await page.locator('.event-projection-heading,.event-projection-date,.event-projection-title,.event-projection-detail').evaluateAll(nodes=>nodes.map(node=>({color:getComputedStyle(node).color,shadow:getComputedStyle(node).textShadow})));
 assert(colors.every(x=>theme==='light'?['rgb(255, 255, 255)','rgb(241, 245, 249)'].includes(x.color):x.color==='rgb(17, 24, 39)'));
 assert(colors.every(x=>x.shadow!=='none'));
 assert.equal(await page.locator('.event-projection-item').count(),4);
 assert.equal(await page.locator('.event-projection-date').first().evaluate(n=>getComputedStyle(n).fontWeight),'800');
 await page.screenshot({path:`/tmp/events-contrast-${variant}.png`});
 state.projectedEvents=[{id:5,eventType:'BIRTHDAY_LIST',birthdayMonth:9,birthdayEntries:Array.from({length:8},(_,i)=>({name:'Birthday Person '+(i+1),month:9,day:i+1}))}];state.projectedEvent=state.projectedEvents[0];
 await sendLive(state);
 await page.locator('.birthday-row').first().waitFor();assert.equal(await page.locator('.birthday-name').first().evaluate(n=>getComputedStyle(n).color),theme==='light'?'rgb(255, 255, 255)':'rgb(17, 24, 39)');
 console.log('PASS Events and Birthdays contrast theme:',variant,theme);
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
