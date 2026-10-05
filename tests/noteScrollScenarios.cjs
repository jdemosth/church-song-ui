const assert = require('node:assert/strict');
module.exports = async function noteScrollScenarios(page, projector, note) {
 const scroller = projector.locator('.note-fit-container');
 const top = () => scroller.evaluate(e => e.scrollTop);
 const socketsBefore = await Promise.all([page,projector].map(p=>p.evaluate(()=>window.testSockets?.length)));
 const title=page.locator('.notes-panel h3');
 async function assertWholeLines() {
  const result=await projector.locator('.note-text').evaluate(e=>{
   const box=e.parentElement.getBoundingClientRect(), range=document.createRange(), node=e.firstChild;
   for(let i=0;i<node.length;i++) {range.setStart(node,i);range.setEnd(node,i+1);
    for(const rect of range.getClientRects()) if(rect.width>0 && rect.bottom>box.top+1 && rect.top<box.bottom-1)
     if(rect.top<box.top-1 || rect.bottom>box.bottom+1) return {top:rect.top,bottom:rect.bottom,boxTop:box.top,boxBottom:box.bottom,scroll:e.parentElement.scrollTop,height:e.parentElement.clientHeight,lineHeight:getComputedStyle(e).lineHeight,width:innerWidth};
   }
   return true;
  }); assert.equal(result,true,JSON.stringify(result));
 }

 const send = async () => {
  await page.getByRole('button',{name:'Preview Note',exact:true}).click();
  await page.getByRole('button',{name:'Send Note Live',exact:true}).last().click();
  await projector.waitForFunction(() => document.querySelector('.note-fit-container')?.scrollTop === 0);
 };
 for (const [width,height] of [[1920,1080],[1440,900],[1280,720],[1024,768],[768,1024],[390,844],[844,390]]) {
  await projector.setViewportSize({width,height}); await projector.waitForTimeout(100);
  assert.equal(await projector.locator('.note-text').count(),1);
  assert.equal(await projector.locator('.note-text').textContent(),note,'one complete, unsplit note');
  const result = await projector.locator('.note-text').evaluate(e => {
   const c=e.parentElement, t=e.getBoundingClientRect(), b=c.getBoundingClientRect(), css=getComputedStyle(e);
   return {align:css.textAlign,whiteSpace:css.whiteSpace,font:parseFloat(css.fontSize),top:Math.abs(t.top-b.top)<1,width:e.scrollWidth<=c.clientWidth+1,overflow:c.scrollHeight>c.clientHeight,lyric:e.classList.contains('screen-lyrics')};
  });
  assert.equal(result.align,'left');assert.equal(result.whiteSpace,'pre-wrap');
  assert(result.font>=22 && result.top && result.width && result.overflow && !result.lyric,JSON.stringify(result));
  await title.click();await page.keyboard.press('ArrowDown');await projector.waitForFunction(()=>document.querySelector('.note-fit-container').scrollTop>0);await assertWholeLines();
  await page.keyboard.press('ArrowUp');await projector.waitForFunction(()=>document.querySelector('.note-fit-container').scrollTop===0);
  await page.keyboard.press('PageDown');await projector.waitForFunction(()=>document.querySelector('.note-fit-container').scrollTop>0);await assertWholeLines();
  const distance=await top(), viewportHeight=await scroller.evaluate(e=>e.clientHeight);
  assert(distance<viewportHeight,'page navigation retains overlap');
  await page.keyboard.press('PageUp');await projector.waitForFunction(()=>document.querySelector('.note-fit-container').scrollTop===0);await assertWholeLines();
 }
 await projector.setViewportSize({width:1280,height:720});
 const navigation=page.getByRole('group',{name:'Live note navigation'});
 assert.equal(await navigation.getByRole('button').count(),2);
 assert.equal(await navigation.getByRole('status').textContent(),'Note Navigation');
 assert.equal(await navigation.locator('small').textContent(),'Keyboard: ↑ ↓ PgUp PgDn');
 assert.equal(await page.getByRole('button',{name:/Scroll Note|Note Page/}).count(),0);
 for(const width of [1440,768,430,390,320]) {
  await page.setViewportSize({width,height:900});
  assert(await navigation.evaluate(element=>{const box=element.getBoundingClientRect();return [...element.querySelectorAll('button')].every(button=>{const r=button.getBoundingClientRect();return r.left>=box.left&&r.right<=box.right&&r.height>=34})}),`compact navigation fits ${width}`);
 }
 await navigation.getByRole('button',{name:'Next ›',exact:true}).click();
 await projector.waitForFunction(()=>document.querySelector('.note-fit-container').scrollTop>0);
 const buttonDistance=await top();await assertWholeLines();
 await navigation.getByRole('button',{name:'‹ Previous',exact:true}).click();
 await projector.waitForFunction(()=>document.querySelector('.note-fit-container').scrollTop===0);
 await title.click();await page.keyboard.press('PageDown');
 await projector.waitForFunction(distance=>document.querySelector('.note-fit-container').scrollTop===distance,buttonDistance);
 await page.keyboard.press('PageUp');await projector.waitForFunction(()=>document.querySelector('.note-fit-container').scrollTop===0);
 await page.setViewportSize({width:1280,height:900});
 await title.click();
 await page.keyboard.press('ArrowUp'); assert.equal(await top(),0);
 await page.keyboard.press('ArrowDown'); await projector.waitForFunction(()=>document.querySelector('.note-fit-container').scrollTop>0);
 const first=await top();
 await projector.locator('.note-document').click({position:{x:10,y:10}});await projector.keyboard.press('ArrowDown');
 await projector.waitForFunction(old=>document.querySelector('.note-fit-container').scrollTop>old,first);
 await projector.keyboard.press('ArrowUp');
 await projector.waitForFunction(old=>Math.abs(document.querySelector('.note-fit-container').scrollTop-old)<2,first);
 await page.getByRole('button',{name:'Black Screen / Restore',exact:true}).click();
 await projector.locator('.projector-screen.black').waitFor();assert.equal(await top(),first);
 await page.getByRole('button',{name:'Black Screen / Restore',exact:true}).click();await projector.locator('.note-text').waitFor();assert.equal(await top(),first);
 await page.getByRole('button',{name:'Clear / Show Lyrics',exact:true}).click();await projector.locator('.note-text').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Clear / Show Lyrics',exact:true}).click();await projector.locator('.note-text').waitFor();assert.equal(await top(),first);
 assert.deepEqual(await Promise.all([page,projector].map(p=>p.evaluate(()=>window.testSockets?.length))),socketsBefore,'scrolling, rendering, resize and Black/Clear do not recreate sockets');
 if (await projector.evaluate(()=>Boolean(window.testSockets))) {
  await projector.evaluate(()=>window.testSockets.at(-1).close());await projector.waitForTimeout(1900);
  assert.equal(await projector.locator('.note-text').textContent(),note);assert.equal(await top(),first);
  await projector.keyboard.press('ArrowDown');await projector.waitForFunction(old=>document.querySelector('.note-fit-container').scrollTop>old,first);
 }
 await title.click();for(let i=0;i<25;i++)await page.keyboard.press('PageDown');
 await projector.waitForFunction(()=>{const e=document.querySelector('.note-fit-container');return Math.abs(e.scrollTop-(e.scrollHeight-e.clientHeight))<2});
 await assertWholeLines();
 const bottom=await top();await page.keyboard.press('ArrowDown');await projector.waitForTimeout(80);assert.equal(await top(),bottom);
 await page.getByLabel('Note',{exact:true}).fill(note+'\nEdited draft');assert.equal(await top(),bottom);assert.equal(await projector.locator('.note-text').textContent(),note);
 const beforeRefresh=await top();await page.reload();await page.getByRole('button',{name:'Notes',exact:true}).click();
 assert.equal(await top(),beforeRefresh,'operator refresh keeps live content/position');
 if (await projector.evaluate(()=>Boolean(window.testSockets))) await page.getByRole('button',{name:'‹ Previous',exact:true}).waitFor();
 await page.getByLabel('Note',{exact:true}).fill(note);await send();assert.equal(await top(),0,'new explicit send resets even the identical text');
 await title.click();await page.keyboard.press('ArrowDown');await projector.waitForFunction(()=>document.querySelector('.note-fit-container').scrollTop>0);
 await projector.reload();await projector.waitForTimeout(300);assert.equal(await projector.locator('.note-text').count(),0,'refresh starts blank');
 await projector.keyboard.press('ArrowDown');assert.equal(await projector.locator('.note-text').count(),0);
 await send();assert.equal(await top(),0);
 console.log('PASS continuous Note layout, operator/projector keys, boundaries, draft/refresh safety, black/clear preservation, explicit-send reset and reconnect where available');
};
