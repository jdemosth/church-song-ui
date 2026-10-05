const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const ui = process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5188';
    const songs = Array.from({ length: 18 }, (_, index) => ({ id: index + 1,
      title: index % 3 === 0 ? 'A long song title with many words to wrap safely inside its own column' : index % 3 === 1 ? 'AnExtremelyLongUnbrokenTitleThatMustNotCompressTheAddButton' : 'Short Song',
      author: 'A long author name for layout verification', songType: index % 2 ? 'FAST' : 'SLOW', language: 'ENGLISH', lyrics: '[Verse 1]\nTest' }));
    await context.route(`http://${new URL(ui).hostname}:8080/**`, route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/projector/capabilities') return route.fulfill({ status: 404, json: {} });
      return route.fulfill({ json: path === '/songs' ? songs : path === '/playlists' ? [{ id: 1, name: 'Test Playlist', songs: [songs[0]], reusable: true }] : path === '/settings' ? { churchName: 'Layout Test' } : [] });
    });
    const page = await context.newPage();
    await page.goto(ui);
    await page.locator('.side-nav').getByRole('button', { name: /Playlists/ }).click();
    await page.locator('.playlist-library-actions button').first().waitFor();
    for (const width of [1920,1440,1280,1024,768,430,390,375,320]) {
      await page.setViewportSize({ width, height: 900 });
      const rows = await page.locator('.playlist-library-song-list .song-item').evaluateAll(cards => cards.map(card => {
        const button = card.querySelector('.inline-button'), badge = card.querySelector('.type-label');
        const b = button.getBoundingClientRect(), r = card.getBoundingClientRect(), copy = card.querySelector('.song-copy').getBoundingClientRect();
        const list = card.closest('.app-scrollable').getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(button);
        const text = range.getBoundingClientRect();
        return { width: b.width, height: b.height, label: button.textContent, nowrap: getComputedStyle(button).whiteSpace,
          textHeight: text.height, left: b.left, right: b.right, top: b.top, bottom: b.bottom,
          copyRight: copy.right, copyBottom: copy.bottom, actionLeft: badge.getBoundingClientRect().left,
          cardRight: r.right, listRight: list.right, scrollWidth: card.scrollWidth, clientWidth: card.clientWidth };
      }));
      assert.equal(rows.length, 18);
      assert(rows.some(row => row.label === 'Added'));
      for (const row of rows) {
        assert.equal(row.width,64); assert.equal(row.height,44); assert.equal(row.nowrap,'nowrap');
        assert(row.textHeight < 22, 'single-line label');
        assert(row.copyRight <= row.actionLeft || row.copyBottom <= row.top, 'title does not overlap actions');
        assert(row.right <= row.cardRight - 10 && row.right <= row.listRight - 4, 'button clear of card edge and scrollbar');
        assert.equal(row.right, rows[0].right, 'aligned Add buttons');
        assert(row.scrollWidth <= row.clientWidth + 1, 'no row overflow');
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no page overflow');
      console.log('PASS consistent Add/Added dimensions, long titles and scrollbar clearance at ' + width);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
