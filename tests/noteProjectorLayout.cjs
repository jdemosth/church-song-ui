const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch();
 try {
  const context = await browser.newContext();
  const ui = process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5188';
  await context.route(`http://${new URL(ui).hostname}:8080/**`, r => r.fulfill(new URL(r.request().url()).pathname === '/projector/capabilities' ? {status:404,json:{}} : {json:[]}));
  const page = await context.newPage(), projector = await context.newPage();
  await page.goto(ui); await projector.goto(ui + '/?projector=1');
  await page.getByRole('button',{name:'Notes',exact:true}).click();
  for (const text of ['1. First statement\n2. Scripture\n\nA separate paragraph.', 'W'.repeat(2000)]) {
   await page.getByLabel('Note',{exact:true}).fill(text);
   await page.getByRole('button',{name:'Preview Note',exact:true}).click();
   await page.getByRole('button',{name:'Send Note Live',exact:true}).last().click();
   await projector.waitForFunction(value=>document.querySelector('.note-text')?.textContent===value,text);
   for (const [width,height] of [[1920,1080],[1280,720],[390,844],[844,390]]) {
    await projector.setViewportSize({width,height});await projector.waitForTimeout(80);
    assert.equal(await projector.locator('.note-text').count(),1);
    assert.equal(await projector.locator('.note-text').textContent(),text);
    assert(await projector.locator('.note-text').evaluate(e=>e.scrollWidth<=e.parentElement.clientWidth+1));
   }
  }
  const scroll=projector.locator('.note-projector-content');
  const css=await scroll.evaluate(e=>({overflow:getComputedStyle(e).overflowY,hidden:getComputedStyle(e).scrollbarWidth,webkit:getComputedStyle(e,'::-webkit-scrollbar').display}));
  assert.deepEqual(css,{overflow:'auto',hidden:'none',webkit:'none'});
  await scroll.hover();await projector.mouse.wheel(0,240);
  await projector.waitForFunction(()=>document.querySelector('.note-projector-content').scrollTop>0);
  await projector.mouse.wheel(0,-100000);
  await projector.waitForFunction(()=>document.querySelector('.note-projector-content').scrollTop===0);
  console.log('PASS hidden scrollbar with native wheel/trackpad-style scrolling retained');
  const note=Array.from({length:30},(_,i)=>`${i+1}. Un paragraphe unique de réflexion, de foi et d’espérance.`).join('\n');
  await page.getByLabel('Note',{exact:true}).fill(note);
  await page.getByRole('button',{name:'Preview Note',exact:true}).click();
  await page.getByRole('button',{name:'Send Note Live',exact:true}).last().click();
  await projector.locator('.note-text').waitFor();
  await require('./noteScrollScenarios.cjs')(page,projector,note);
 } finally { await browser.close() }
})().catch(error=>{console.error(error);process.exitCode=1});
