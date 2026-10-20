const assert = require('node:assert/strict');
module.exports = async (o,p,origin) => {
 const field=name=>o.locator('label.bible-form-field').filter({has:o.getByText(name,{exact:true})}).locator('select');
 const send=()=>o.locator('.bible-live-nav-buttons').getByRole('button',{name:'Send to Projector',exact:true}).click();
 const codes=['WEB','LSG1910','HAT1985'];
 async function texts(book,chapter,verse){return Promise.all(codes.map(async code=>{
  const r=await fetch(`${origin}/bible/passage?translation=${code}&book=${book}&chapter=${chapter}&startVerse=${verse}&endVerse=${verse}`);assert(r.ok);return (await r.json()).verses[0].text;
 }));}
 async function shown(book,chapter,verse){const expected=await texts(book,chapter,verse);await p.waitForFunction(t=>JSON.stringify([...document.querySelectorAll('.bible-projector-verse')].map(e=>e.textContent))===JSON.stringify(t),expected);return expected;}
 async function prepare(book,chapter,verse){await field('Book').selectOption(book);await o.waitForLoadState('networkidle');await field('Chapter').selectOption(String(chapter));await o.waitForLoadState('networkidle');await field('Start Verse').selectOption(String(verse));await o.getByRole('button',{name:'Preview Passage',exact:true}).click();}
 // Simulate the currently running older API: HAT1985 text is correct but bookName is English.
 await o.route('**/bible/passage?*', async route => {
  const url=new URL(route.request().url());
  if(url.searchParams.get('translation') !== 'HAT1985') return route.continue();
  const response=await route.fetch(); const body=await response.json();
  const english={JOHN:'John',PSALMS:'Psalms',GENESIS:'Genesis',MATTHEW:'Matthew',ACTS:'Acts',REVELATION:'Revelation'};
  if(english[body.bookKey]) body.bookName=english[body.bookKey];
  await route.fulfill({response,json:body});
 });
 await prepare('JOHN',3,16);
 await o.getByRole('button',{name:'English + Français + Kreyòl',exact:true}).click();
 const before=await p.locator('.projector-screen').innerText();
 await o.locator('.bible-presentation-preview summary').click();
 const expected=await texts('JOHN',3,16);
 await o.waitForFunction(t=>JSON.stringify([...document.querySelectorAll('.bible-presentation-preview .bible-projector-verse')].map(e=>e.textContent))===JSON.stringify(t),expected);
 assert.equal(await p.locator('.projector-screen').innerText(),before,'trilingual preview remains preparation');
 assert.deepEqual(await o.locator('.bible-presentation-preview .bible-projector-reference').allTextContents(),['John 3:16','Jean 3:16','Jan 3:16']);
 await send();await shown('JOHN',3,16);
 assert.deepEqual(await p.locator('.bible-projector-reference').allTextContents(),['John 3:16','Jean 3:16','Jan 3:16']);
 for(const [width,height] of [[1920,1080],[1280,720],[1024,768]]){
  await p.setViewportSize({width,height});await p.waitForTimeout(80);
  assert(await p.locator('.bible-projector-block').evaluateAll(rows=>rows.every(r=>r.firstElementChild.scrollHeight<=r.clientHeight&&r.firstElementChild.scrollWidth<=r.clientWidth)));
 }
 const jump=o.getByLabel('Live verse number',{exact:true});await jump.fill('18');await jump.press('Enter');await shown('JOHN',3,18);
 await o.locator('.right-console .current-heading h3').click();await o.keyboard.press('ArrowUp');await shown('JOHN',3,17);
 assert.deepEqual(await p.locator('.bible-projector-reference').allTextContents(),['John 3:17','Jean 3:17','Jan 3:17']);
 await o.locator('.right-console .current-heading h3').click();await o.keyboard.press('ArrowDown');await shown('JOHN',3,18);
 await jump.fill('36');await jump.press('Enter');await shown('JOHN',3,36);
 await o.locator('.right-console .current-heading h3').click();await o.keyboard.press('ArrowDown');await shown('JOHN',3,36);
 await prepare('JOHN',4,1);await shown('JOHN',3,36);await send();await shown('JOHN',4,1);
 await o.locator('.right-console .current-heading h3').click();await o.keyboard.press('ArrowUp');await shown('JOHN',4,1);
 // WEB omits Luke 17:36. Never shift numbering or invent a matching verse.
 await prepare('LUKE',17,35);await send();await shown('LUKE',17,35);
 await o.locator('.right-console .current-heading h3').click();await o.keyboard.press('ArrowDown');await shown('LUKE',17,37);
 await jump.fill('36');await jump.press('Enter');await shown('LUKE',17,37);
 await prepare('ESTHER',8,9);await send();await shown('ESTHER',8,9);
 for(const [width,height] of [[1920,1080],[1280,720],[1024,768]]) {
  await p.setViewportSize({width,height});await p.waitForTimeout(80);
  const fit=await p.locator('.bible-projector-block').evaluateAll(rows=>rows.map(r=>({fits:r.firstElementChild.scrollHeight<=r.clientHeight&&r.firstElementChild.scrollWidth<=r.clientWidth,font:parseFloat(getComputedStyle(r.querySelector('.bible-projector-verse')).fontSize)})));
  assert(fit.every(r=>r.fits&&r.font>=22),JSON.stringify({width,height,fit}));
 }
 for(const [book,chapter,verse,en,fr,ht] of [
  ['JOHN',3,16,'John','Jean','Jan'],['PSALMS',91,1,'Psalms','Psaumes','Sòm'],
  ['GENESIS',1,1,'Genesis','Genese','Jenèz'],['MATTHEW',5,1,'Matthew','Matthieu','Matye'],
  ['ACTS',2,1,'Acts','Actes','Travay'],['REVELATION',22,21,'Revelation','Apocalypse','Revelasyon'],
 ]) {
  await prepare(book,chapter,1);
  await field('End Verse').selectOption(String(verse));
  await o.getByRole('button',{name:'Preview Passage',exact:true}).click();
  await o.locator('.bible-console-verse').filter({has:o.locator('strong').filter({hasText:new RegExp('^'+verse+'$')})}).click();
  const refs=[en,fr,ht].map(n=>`${n} ${chapter}:${verse}`);
  await o.locator('.bible-presentation-preview .bible-projector-reference').first().waitFor({state:'attached'});
  await o.waitForFunction(refs=>JSON.stringify([...document.querySelectorAll('.bible-presentation-preview .bible-projector-reference')].map(e=>e.textContent))===JSON.stringify(refs),refs);
  await send();await shown(book,chapter,verse);
  assert.deepEqual(await p.locator('.bible-projector-reference').allTextContents(),refs);
  for (const page of [o,p]) assert(await page.locator('.bible-projector-reference').evaluateAll(rows=>rows.length>0&&rows.every(r=>getComputedStyle(r).fontWeight==='700')));
 }
 await o.unroute('**/bible/passage?*');
 console.log('PASS all six localized references in preview and separate projector with legacy English HAT1985 names');
 console.log('PASS real WEB/LSG1910/HAT1985 preview/send, large-screen fit, Previous/Next/jump, chapter boundary safety and common-reference gaps');
};
