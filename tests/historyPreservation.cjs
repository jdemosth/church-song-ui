// Real HTTP + UI against the disposable database supplied by networkProjector.cjs.
const assert = require('node:assert/strict');
module.exports = async (browser, origin) => {
  const context = await browser.newContext();
  let page;
  const errors = [];
  try {
    page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    const api = context.request;
    async function create(route, data) {
      const response = await api.post(origin + route, { data });
      assert(response.ok(), `${route}: ${response.status()} ${await response.text()}`);
      return response.json();
    }
    const song = await create('/songs', { title: 'Frozen history song', lyrics: '[Verse 1]\nOriginal history lyrics', songType: 'SLOW', language: 'ENGLISH' });
    const working = await create('/service-plans', { serviceName: 'Preservation fixture', serviceType: 'Other', serviceDate: '2099-10-20', serviceTime: '10:00', songIds: [song.id, song.id] });
    const completed = await create(`/service-plans/${working.id}/complete`, {});
    const originalPayload = completed.snapshotPayload;
    await page.goto(origin);
    const nav = name => page.locator('nav.side-nav').getByRole('button', { name: new RegExp(name) }).click();
    await nav('Service History');
    await page.getByText('Contents saved when this service was completed.', { exact: true }).waitFor();
    assert.equal(await page.locator('.history-service-detail').getByRole('button', { name: 'Delete', exact: true }).count(), 0);
    assert.equal(await page.locator('.history-service-detail .service-song-copy strong').count(), 2);
    await nav('Songs');
    await page.locator('.songs-management-grid .song-item').filter({ hasText: 'Frozen history song' }).first().click();
    await page.getByRole('button', { name: 'Edit Song', exact: true }).click();
    await page.locator('.modal').getByLabel('Title', { exact: true }).fill('Changed library song');
    await page.locator('.modal textarea[name="lyrics"]').fill('[Verse 1]\nChanged library lyrics');
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.locator('.modal-overlay').waitFor({ state: 'hidden' });
    await nav('Service History');
    assert.deepEqual(await page.locator('.history-service-detail .service-song-copy strong').allTextContents(), ['Frozen history song', 'Frozen history song']);
    const deleted = await api.delete(origin + `/songs/${song.id}`); assert(deleted.ok());
    await page.reload(); await nav('Service History');
    assert.deepEqual(await page.locator('.history-service-detail .service-song-copy strong').allTextContents(), ['Frozen history song', 'Frozen history song']);
    assert.equal((await api.delete(origin + `/service-plans/history/${completed.id}`)).status(), 409);
    assert.equal((await api.put(origin + `/service-plans/${completed.id}`, { data: { serviceName: 'Changed', serviceDate: '2099-10-20' } })).status(), 409);
    const reused = await create(`/service-plans/${completed.id}/reuse`, { serviceName: 'Preserved reuse', serviceType: 'Other', serviceDate: '2099-10-21' });
    assert.deepEqual(reused.songs.map(item => item.lyrics), ['[Verse 1]\nOriginal history lyrics', '[Verse 1]\nOriginal history lyrics']);
    assert(reused.songs.every(item => item.id !== song.id));
    assert.equal((await (await api.get(origin + `/service-plans/${completed.id}`)).json()).snapshotPayload, originalPayload);
    assert.deepEqual(errors, []);
    console.log('PASS real history UI/API: cache survives library edit; deletion/reload retains lyrics/order; immutable endpoints; reuse materializes frozen contents');
  } catch (error) {
    console.error('History fixture failure:', { errors, modal: page ? await page.locator('.modal').allTextContents() : [] });
    throw error;
  } finally { await context.close(); }
};
