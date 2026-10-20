// Synthetic integration fixtures ONLY; never bundled or inserted in any Bible database.
const assert = require('node:assert/strict');
module.exports = async (o,p) => {
 await o.getByRole('button',{name:'Bible',exact:true}).click();
 await o.route('**/bible/translations',r=>r.fulfill({json:[{code:'KJV',language:'ENGLISH'},{code:'LSG1910',language:'FRENCH'}]}));
 await o.reload();await o.locator('.playlist-select').selectOption('1');await o.getByRole('button',{name:'Bible',exact:true}).click();await o.getByRole('button',{name:'Preview Passage',exact:true}).click();
 assert(await o.getByRole('button',{name:'English + Français + Kreyòl',exact:true}).isDisabled());
 await o.route('**/bible/books?**',r=>r.fulfill({json:[{key:'JOHN',name:'John',chapterCount:2}]}));
 await o.route('**/bible/**/metadata?**',r=>r.fulfill({json:{bookKey:'JOHN',chapter:1,availableVerseNumbers:[1,2,3]}}));
 await o.route('**/bible/translations',r=>r.fulfill({json:[{code:'KJV',language:'ENGLISH'},{code:'LSG1910',language:'FRENCH'},{code:'TEST_HT',language:'HAITIAN_CREOLE'}]}));
 await o.route('**/bible/passage?**',r=>{
  const code=new URL(r.request().url()).searchParams.get('translation');
  return r.fulfill({json:{bookKey:'JOHN',bookName:'John',chapter:1,startVerse:1,endVerse:3,translationCode:code,verses:[1,2,3].map(verseNumber=>({verseNumber,text:`TEST FIXTURE ${code} verse ${verseNumber}`}))}});
 });
 await o.reload();await o.locator('.playlist-select').selectOption('1');await o.getByRole('button',{name:'Bible',exact:true}).click();
 await o.getByRole('button',{name:'Preview Passage',exact:true}).click();
 for(const [label,codes] of [['English',['KJV']],['Français',['LSG1910']],['Español',['RV1909']],['Français + English',['KJV','LSG1910']],['English + Français + Kreyòl',['WEB','LSG1910','TEST_HT']]]) {
  await o.locator('.bible-projection-mode-pills').getByRole('button',{name:label,exact:true}).click();
  await o.locator('.bible-live-nav-buttons').getByRole('button',{name:'Send to Projector',exact:true}).click();
  await p.waitForFunction(expected=>JSON.stringify([...document.querySelectorAll('.bible-projector-verse')].map(e=>e.textContent))===JSON.stringify(expected),codes.map(c=>`TEST FIXTURE ${c} verse 1`));
  assert.deepEqual(await p.locator('.bible-projector-verse').allTextContents(),codes.map(c=>`TEST FIXTURE ${c} verse 1`));
 }
 await o.locator('.bible-presentation-preview summary').click();
 await o.waitForFunction(()=>document.querySelectorAll('.bible-presentation-preview .bible-projector-verse').length===3);
 assert.deepEqual(await o.locator('.bible-presentation-preview .bible-projector-verse').allTextContents(),await p.locator('.bible-projector-verse').allTextContents());
 const jump=o.getByLabel('Live verse number',{exact:true});await jump.fill('3');await jump.press('Enter');
 await p.getByText('TEST FIXTURE TEST_HT verse 3',{exact:true}).waitFor();
 await o.locator('.right-console .current-heading h3').click();await o.keyboard.press('ArrowUp');await p.getByText('TEST FIXTURE TEST_HT verse 2',{exact:true}).waitFor();
 assert.deepEqual(await p.locator('.bible-projector-verse').allTextContents(),['WEB','LSG1910','TEST_HT'].map(c=>`TEST FIXTURE ${c} verse 2`));
 await o.locator('.right-console .current-heading h3').click();await o.keyboard.press('ArrowDown');await p.getByText('TEST FIXTURE TEST_HT verse 3',{exact:true}).waitFor();
 console.log('PASS absent Kreyòl disabled; synthetic installed-translation fixture proves single/dual/trilingual, matching preview, jump and navigation through real WebSocket');
};
