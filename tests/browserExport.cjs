const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    // A static test origin avoids loading application code or contacting any API.
    await context.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<title>Export fixture</title>' }));
    await page.goto(process.env.EVENTS_TEST_URL);
    const script = fs.readFileSync(path.join(__dirname, '../tools/export-browser-storage.js'), 'utf8');
    async function exported() {
      const pending = page.waitForEvent('download');
      const summary = await page.evaluate(script);
      const download = await pending;
      return { summary, data: JSON.parse(fs.readFileSync(await download.path(), 'utf8')) };
    }
    assert.deepEqual(await page.evaluate(() => indexedDB.databases()), []);
    assert.equal((await exported()).summary.databaseStatus, 'absent');
    assert.deepEqual(await page.evaluate(() => indexedDB.databases()), [], 'export does not create a missing database');
    await page.evaluate(async () => {
      localStorage.setItem('church-song-notes:service-7', JSON.stringify({ draft: 'Grâce\nPrivate fixture', history: [{ text: 'Earlier note', at: '2026-01-01T00:00:00Z' }], archive: { topic: 'Faith' } }));
      localStorage.setItem('church-song-projector-state', '{"projectionMode":"CLEAR"}');
      localStorage.setItem('unrelated-key', 'untouched');
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open('church-song-ui', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('projection-backgrounds', { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const transaction = database.transaction('projection-backgrounds', 'readwrite');
        transaction.objectStore('projection-backgrounds').put({ id: 'fixture', fileName: 'pixel.png', mimeType: 'image/png', updatedAt: 123,
          file: new File([new Uint8Array([0, 1, 127, 255])], 'pixel.png', { type: 'image/png', lastModified: 456 }) });
        transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    });
    const before = await page.evaluate(() => ({ ...localStorage }));
    const { data } = await exported();
    assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), before);
    assert.equal(data.localStorage['unrelated-key'], undefined);
    assert.equal(data.localStorage['church-song-notes:service-7'], before['church-song-notes:service-7']);
    assert.deepEqual(Buffer.from(data.indexedDB.backgrounds[0].dataUrl.split(',')[1], 'base64'), Buffer.from([0, 1, 127, 255]));
    assert.deepEqual((await exported()).data.indexedDB, data.indexedDB, 'background export leaves records unchanged');
    // Restore only into a fresh disposable context, never the source browser.
    const restored = await browser.newContext();
    await restored.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<title>Restore fixture</title>' }));
    const target = await restored.newPage(); await target.goto(process.env.EVENTS_TEST_URL);
    await target.evaluate(async data => {
      for (const [key, value] of Object.entries(data.localStorage)) localStorage.setItem(key, value);
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open('church-song-ui', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('projection-backgrounds', { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      for (const record of data.indexedDB.backgrounds) {
        const bytes = Uint8Array.from(atob(record.dataUrl.split(',')[1]), character => character.charCodeAt(0));
        await new Promise((resolve, reject) => {
          const transaction = database.transaction('projection-backgrounds', 'readwrite');
          transaction.objectStore('projection-backgrounds').put({ id: record.id, fileName: record.fileName, mimeType: record.mimeType, updatedAt: record.updatedAt,
            file: new File([bytes], record.fileName, { type: record.blobType, lastModified: record.lastModified }) });
          transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error);
        });
      }
      database.close();
    }, data);
    const pending = target.waitForEvent('download'); await target.evaluate(script);
    const download = await pending; const roundTrip = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.deepEqual(roundTrip.localStorage, data.localStorage);
    assert.deepEqual(roundTrip.indexedDB, data.indexedDB);
    console.log('PASS browser export: absent DB unchanged; notes/history exact; background bytes/metadata exact; fresh-context restore round trip');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
