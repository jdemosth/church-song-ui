const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch();try{
 const context=await browser.newContext(),ui=process.env.EVENTS_TEST_URL||'http://127.0.0.1:5188';
 if(process.env.NO_BROADCAST) await context.addInitScript(()=>{delete window.BroadcastChannel});
 const requests=[];
 await context.route(`http://${new URL(ui).hostname}:8080/**`,r=>{
  const p=new URL(r.request().url()).pathname;requests.push(p);
  if(p==='/projector/capabilities')return r.fulfill({status:404,json:{}});
  return r.fulfill({json:p==='/settings'?{churchName:'Test',defaultBackground:'sunrise'}:[]});
 });
 const page=await context.newPage();await page.goto(ui);await page.getByRole('button',{name:'Notes',exact:true}).click();
 const projector=await context.newPage();await projector.goto(ui+'/?projector=1');
 const text='1. The 7 spirits of the Lord\n2. Esaie 11 : 1';
 const draft=page.getByLabel('Note',{exact:true}),preview=page.getByRole('button',{name:'Preview Note',exact:true});
 const dialog=page.getByRole('dialog',{name:'Review Note',exact:true});
 await page.getByLabel('Date',{exact:true}).fill('1991-03-20');
 await draft.fill(text);await preview.click();await dialog.waitFor();
 assert.equal(await dialog.locator('.note-proofread-text').textContent(),text);
 assert.equal(await dialog.locator('.note-heading-subject').count(),0);
 assert.equal(await dialog.locator('.note-heading-date').textContent(),'Date: March 20, 1991');
 assert(await dialog.locator('.note-heading').evaluate(e=>{const s=getComputedStyle(e);return parseFloat(s.borderTopWidth)>0&&parseFloat(s.borderBottomWidth)>0}));
 assert.equal(await projector.locator('.projector-screen').innerText(),'');
 await dialog.getByRole('button',{name:'Return to Editing',exact:true}).click();
 assert.equal(await draft.inputValue(),text);assert(await draft.evaluate(e=>e===document.activeElement));
 assert.equal(await page.locator('.note-preview').count(),0,'no inline projector simulation');
 await page.getByRole('button',{name:'Send Note Live',exact:true}).click();await projector.getByText('1. The 7 spirits of the Lord',{exact:false}).waitFor();
 assert.equal(await projector.locator('.note-heading-subject').count(),0);
 assert.equal(await projector.locator('.note-heading-date').textContent(),'Date: March 20, 1991');
 const live=await projector.locator('.projector-screen').innerText();
 await page.getByLabel('Subject',{exact:true}).fill('Prepared header only');
 assert(await page.getByRole('button',{name:'Send Note Live',exact:true}).isDisabled(),'header edits require another preview');
 assert.equal(await projector.locator('.projector-screen').innerText(),live);
 await preview.click();assert.equal(await dialog.locator('.note-heading-subject').textContent(),'Subject: Prepared header only');
 await dialog.getByRole('button',{name:'Return to Editing',exact:true}).click();
 await page.getByLabel('Subject',{exact:true}).fill('');
 assert(await page.getByRole('button',{name:'Send Note Live',exact:true}).isDisabled());

 const long=('A long readable paragraph to proofread with numbered lines. '.repeat(28)+'\n\n2. The final paragraph\nLast line remains visible.').slice(0,2000);
 for(const [width,height] of [[1440,900],[1024,768],[768,1024],[430,932],[390,844],[320,568],[844,390]]) {
  await page.setViewportSize({width,height});await draft.fill(long);await preview.click();await dialog.waitFor();
  assert.equal(await dialog.locator('.note-proofread-text').textContent(),long);
  assert.equal(await projector.locator('.projector-screen').innerText(),live,'preview never changes live');
  const result=await dialog.evaluate(d=>{
    const box=d.getBoundingClientRect(),scroller=d.querySelector('.note-proofread-scroll'),text=scroller.firstElementChild;
    const before=scroller.scrollTop;scroller.scrollTop=scroller.scrollHeight;
    return {fits:box.left>=0&&box.right<=innerWidth&&box.top>=0&&box.bottom<=innerHeight+1,
      scrollable:scroller.scrollHeight>scroller.clientHeight,scrolled:scroller.scrollTop>before,
      font:parseFloat(getComputedStyle(text).fontSize),whiteSpace:getComputedStyle(text).whiteSpace,
      lastVisible:text.getBoundingClientRect().bottom<=scroller.getBoundingClientRect().bottom,
      widthOkay:scroller.scrollWidth<=scroller.clientWidth+1};
  });
  assert(result.fits&&result.widthOkay,JSON.stringify(result));assert(result.font>=18);assert.equal(result.whiteSpace,'pre-wrap');
  assert(result.scrollable&&result.scrolled&&result.lastVisible,'complete long note readable by scrolling');
  await dialog.getByRole('button',{name:'Send Note Live',exact:true}).click({trial:true});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await draft.inputValue(),long);
  console.log('PASS proofreading modal full text, wrapping, scrolling, close and isolation at '+width+'x'+height);
 }
 await preview.click();await dialog.getByRole('button',{name:'Send Note Live',exact:true}).click();
 await projector.getByText('A long readable paragraph',{exact:false}).waitFor();await dialog.waitFor({state:'hidden'});
 await draft.fill('Unsaved changed draft');assert.equal(await projector.locator('.note-text').textContent(),long);
 await page.getByLabel('Subject',{exact:true}).fill('New draft subject');
 assert.equal(await projector.locator('.note-heading-subject').count(),0);
 assert(await page.getByRole('button',{name:'Send Note Live',exact:true}).isDisabled());
 console.log('PASS shared panel/modal live send and immutable live Note');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
