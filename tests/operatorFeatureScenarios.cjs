const assert = require('node:assert/strict');
module.exports = async function featureScenarios(page, projector) {
  const nav = async name => page.locator('.side-nav').getByRole('button', {name}).click();
  const shown = async text => projector.getByText(text, {exact:false}).first().waitFor();
  const screen = () => projector.locator('.projector-screen').innerText();
  async function notes() { await nav(/Worship Console/); await page.locator('.playlist-select').selectOption('1'); await page.locator('.prepare-workspace-tab').getByText('Notes',{exact:true}).click(); }
  await notes();
  const before = await screen();
  await page.getByLabel('Note',{exact:true}).fill('Keep faith.\nKeep going.');
  assert.equal(await screen(),before);
  await page.getByRole('button',{name:'Preview Note',exact:true}).click();assert.equal(await screen(),before);
  await page.getByRole('button',{name:'Send Note Live',exact:true}).last().click();await shown('Keep faith.');
  const longNote = ('A longer sermon statement about faith, hope and love.\n'.repeat(35)).slice(0,2000);
  await page.getByLabel('Note',{exact:true}).fill(longNote);
  await page.getByRole('button',{name:'Preview Note',exact:true}).click();
  await page.getByRole('button',{name:'Send Note Live',exact:true}).last().click();await shown('A longer sermon statement');
  await require('./noteScrollScenarios.cjs')(page,projector,longNote);
  await page.getByLabel('Note',{exact:true}).fill('Keep faith.\nKeep going.');
  await page.getByRole('button',{name:'Preview Note',exact:true}).click();await page.getByRole('button',{name:'Send Note Live',exact:true}).last().click();await shown('Keep faith.');
  await page.getByLabel('Note',{exact:true}).fill('A revised sermon statement');await shown('Keep faith.');
  assert(await page.getByRole('button',{name:'Send Note Live',exact:true}).isDisabled());
  await page.getByRole('button',{name:'Black Screen / Restore',exact:true}).click();await projector.locator('.projector-screen.black').waitFor();
  await page.getByRole('button',{name:'Black Screen / Restore',exact:true}).click();await shown('Keep faith.');
  await page.getByRole('button',{name:'Clear / Show Lyrics',exact:true}).click();await projector.locator('.note-text').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Clear / Show Lyrics',exact:true}).click();await shown('Keep faith.');
  await page.reload();await notes();assert.equal(await page.getByLabel('Note',{exact:true}).inputValue(),'A revised sermon statement');await shown('Keep faith.');
  assert(await page.getByRole('button',{name:'Send Note Live',exact:true}).isDisabled());
  await page.getByRole('button',{name:'Preview Note',exact:true}).click();await page.getByRole('button',{name:'Send Note Live',exact:true}).last().click();await shown('A revised sermon statement');
  if (await page.evaluate(() => Boolean(window.testSockets))) {
    await page.getByLabel('Note',{exact:true}).fill('This disconnected send must not replay');
    await page.getByRole('button',{name:'Preview Note',exact:true}).click();
    await page.evaluate(() => window.testSockets.at(-1).close());
    await page.waitForTimeout(100);
    await page.getByRole('button',{name:'Send Note Live',exact:true}).last().click();
    await page.getByText('Projector server is not connected. Reconnect and send again.',{exact:true}).waitFor();
    await page.waitForTimeout(1900);await shown('A revised sermon statement');
    assert(!(await screen()).includes('must not replay'));
    await projector.evaluate(() => window.testSockets.at(-1).close());
    await projector.waitForTimeout(1900);await shown('A revised sermon statement');
    await page.getByRole('button',{name:'Return to Editing',exact:true}).click();
    await page.getByLabel('Note',{exact:true}).fill('A revised sermon statement');
    await page.getByRole('button',{name:'Preview Note',exact:true}).click();
    await page.getByRole('button',{name:'Return to Editing',exact:true}).click();
    console.log('PASS Notes operator/projector reconnect continuity and no disconnected command replay');
  }
  await projector.reload();await projector.locator('.projector-screen').waitFor();assert.equal((await screen()).trim(),'');
  await page.getByRole('button',{name:'Black Screen / Restore',exact:true}).click();await page.getByRole('button',{name:'Black Screen / Restore',exact:true}).click();assert.equal((await screen()).trim(),'');
  await page.getByRole('button',{name:'Send Note Live',exact:true}).last().click();await shown('A revised sermon statement');
  for (const width of [320,390,430,768,1280]) {
    await page.setViewportSize({width,height:844});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Notes fit mobile viewport');
    await page.getByRole('button',{name:'Preview Note',exact:true}).click({trial:true});
  }
  await nav(/Upcoming Events/);
  for (const ids of [[1],[1,3,6,7],[1,3,6,7,10]]) {
    const previous = await screen();
    await page.getByRole('button',{name:'Clear Event Selection',exact:true}).click();
    assert(await page.getByRole('button',{name:'Send to Projector',exact:true}).isDisabled());assert.equal(await screen(),previous);
    for (const id of ids) await page.locator(`[data-keyboard-event="${id}"] input[type="checkbox"]`).check();
    assert.equal(await screen(),previous);
    await page.getByRole('button',{name:'Send to Projector',exact:true}).click();await shown('Event 1');
    await page.waitForTimeout(150);
    assert.deepEqual(await projector.locator('.event-projection-title').allTextContents(),ids.slice(0,4).map(id=>'Event '+id));
    if(ids.length>4){await page.locator('.event-card h3').first().click();await page.keyboard.press('ArrowRight');await shown('Event 10');assert.deepEqual(await projector.locator('.event-projection-title').allTextContents(),['Event 10']);}
  }
  await notes();await page.locator('.prepare-workspace-tab').getByText('Bible',{exact:true}).click();
  await page.getByRole('button',{name:'Preview Passage',exact:true}).click();await page.locator('.bible-console-verse').first().waitFor();
  assert(await page.getByLabel('Live verse number',{exact:true}).isDisabled());
  await page.locator('.bible-projection-mode-pills').getByRole('button',{name:'Français + English',exact:true}).click();
  await page.locator('.bible-live-nav-buttons').getByRole('button',{name:'Send to Projector',exact:true}).click();await shown('Bible verse 1');
  assert.equal(await projector.locator('.bible-projector-verse').first().evaluate(e => getComputedStyle(e).textAlign),'center','Bible verse blocks remain centered');
  assert.equal(await projector.locator('.note-text').count(),0);
  const jump = page.getByLabel('Live verse number',{exact:true});
  for (const number of ['3','1','2']) {await jump.fill(number);await jump.press('Enter');await shown('Bible verse '+number);}
  for (const invalid of ['0','-1','4','abc','1.5']) {await jump.fill(invalid);await jump.press('Enter');await page.getByText('Enter a verse number in the currently live passage.',{exact:true}).waitFor();await shown('Bible verse 2');}
  await page.locator('.right-console .current-heading h3').click();await page.keyboard.press('ArrowDown');await shown('Bible verse 3');await page.keyboard.press('ArrowUp');await shown('Bible verse 2');
  const dual = await screen();assert.equal((dual.match(/Bible verse 2/g) || []).length, 2, 'both language texts retained at the jumped verse');
  await notes();await page.getByRole('button',{name:'Preview Note',exact:true}).click();await page.getByRole('button',{name:'Send Note Live',exact:true}).last().click();await shown('A revised sermon statement');
  await page.locator('.prepare-workspace-tab').getByText('Song',{exact:true}).click();
  await page.locator('.prepared-song-preview').getByRole('button',{name:'Send to Projector',exact:true}).click();await shown('Song 1');
  assert.equal(await projector.locator('.screen-content-song .screen-lyrics').evaluate(e => getComputedStyle(e).textAlign),'center','Song keeps existing lyric alignment');
  assert.equal(await projector.locator('.note-text').count(),0);
  console.log('PASS selected Events 1/4/5 and isolation; live Bible jumps and validation; Notes preview/send/edit/refresh/black/switching/mobile safety');
};
