const assert = require('node:assert/strict');
module.exports = async function (operator, projector, origin) {
 let passages;
 await operator.route('**/bible/**', route => route.continue());
 await operator.reload();await operator.locator('.playlist-select').selectOption('1');await operator.getByRole('button',{name:'Bible',exact:true}).click();
 for (const [book,chapter,start,end] of [['JOHN',3,16,18],['ESTHER',8,9,9]]) {
  passages={};
  for (const code of ['KJV','LSG1910']) {
   const r=await fetch(`${origin}/bible/passage?translation=${code}&book=${book}&chapter=${chapter}&startVerse=${start}&endVerse=${end}`);
   assert(r.ok);passages[code]=await r.json();
  }
  await operator.locator('label.bible-form-field').filter({has:operator.getByText('Book',{exact:true})}).locator('select').selectOption(book);
  await operator.locator('label.bible-form-field').filter({has:operator.getByText('Chapter',{exact:true})}).locator('select').selectOption(String(chapter));
  await operator.locator('label.bible-form-field').filter({has:operator.getByText('Start Verse',{exact:true})}).locator('select').selectOption(String(start));
  await operator.getByRole('button',{name:'Preview Passage',exact:true}).click();
  await operator.locator('.bible-projection-mode-pills').getByRole('button',{name:'Français + English',exact:true}).click();
  await operator.locator('.bible-live-nav-buttons').getByRole('button',{name:'Send to Projector',exact:true}).click();
  await projector.getByText(passages.KJV.verses[0].text,{exact:true}).waitFor();
  assert.deepEqual(await projector.locator('.bible-projector-block').evaluateAll(rows=>rows.map(r=>r.dataset.language)),['ENGLISH','FRENCH']);
  assert.equal(await projector.locator('.screen-reference,.screen-title').count(),0);
  assert.deepEqual(await projector.locator('.bible-projector-reference').allTextContents(),['KJV','LSG1910'].map(code=>`${passages[code].bookName} ${chapter}:${start}`));
  for(const [width,height] of [[1920,1080],[1280,720],[1024,768],[390,844],[844,390]]) {
   await projector.setViewportSize({width,height});await projector.waitForTimeout(100);
   const m=await projector.locator('.projector-screen').evaluate(screen=>({background:getComputedStyle(screen).backgroundColor,image:getComputedStyle(screen).backgroundImage,fits:screen.scrollHeight<=screen.clientHeight&&screen.scrollWidth<=screen.clientWidth,blocks:[...screen.querySelectorAll('.bible-projector-block')].map(row=>{
    const c=row.firstElementChild,v=c.firstElementChild,r=c.lastElementChild,b=row.getBoundingClientRect(),box=r.getBoundingClientRect();
    return {fits:c.scrollHeight<=row.clientHeight&&c.scrollWidth<=row.clientWidth,right:Math.abs(b.right-box.right)<1,below:box.top>=v.getBoundingClientRect().bottom,font:parseFloat(getComputedStyle(v).fontSize),align:getComputedStyle(r).textAlign};
   })}));
   assert.equal(m.background,'rgb(0, 0, 0)');assert.equal(m.image,'none');assert(m.fits);
   for(const r of m.blocks)assert(r.fits&&r.right&&r.below&&r.font>=16&&r.align==='right',JSON.stringify({width,height,r}));
  }
  if(end>start){
   const jump=operator.getByLabel('Live verse number',{exact:true});await jump.fill('18');await jump.press('Enter');await projector.getByText(passages.KJV.verses[2].text,{exact:true}).waitFor();
   await operator.locator('.right-console .current-heading h3').click();await operator.keyboard.press('ArrowUp');await projector.getByText(passages.KJV.verses[1].text,{exact:true}).waitFor();
   await operator.locator('.right-console .current-heading h3').click();await operator.keyboard.press('ArrowDown');await projector.getByText(passages.KJV.verses[2].text,{exact:true}).waitFor();
  }
  await operator.locator('.right-console .current-heading h3').click();await operator.keyboard.press('b');await projector.locator('.projector-screen.black').waitFor();assert.equal(await projector.locator('.bible-projector-verse').count(),0);
  await operator.keyboard.press('b');await projector.locator('.bible-projector-verse').first().waitFor();
  await projector.reload();await projector.waitForTimeout(250);assert.equal(await projector.locator('.bible-projector-verse').count(),0);
  await operator.locator('.bible-live-nav-buttons').getByRole('button',{name:'Send to Projector',exact:true}).click();await projector.locator('.bible-projector-verse').first().waitFor();
 }
 console.log('PASS real John 3:16–18 / Esther 8:9 bilingual layout, five viewports, references, black background, jump/navigation, Black/Restore, refresh/resend over WebSocket');
};
