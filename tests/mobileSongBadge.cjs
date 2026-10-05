const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ hasTouch: true });
    const ui = process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5188';
    const songs = [
      { id: 1, title: 'Song A', author: 'Armstrong Beauzil', songType: 'SLOW' },
      { id: 2, title: 'Song B', author: '', songType: 'FAST' },
      { id: 3, title: 'Un très long titre de chant pour vérifier le retour à la ligne', author: 'Un auteur avec un nom particulièrement long', songType: 'SLOW' },
      { id: 4, title: 'AnExtremelyLongUnbrokenSongTitleForWrapping', author: 'AnExtremelyLongUnbrokenAuthorNameForWrapping', songType: 'FAST' },
    ].map(song => ({ ...song, language: 'ENGLISH', lyrics: '[Verse 1]\nTest lyrics' }));
    await context.route(`http://${new URL(ui).hostname}:8080/**`, route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/projector/capabilities') return route.fulfill({ status: 404, json: {} });
      return route.fulfill({ json: path === '/songs' ? songs : path === '/settings' ? { churchName: 'Layout Test' } : [] });
    });
    const page = await context.newPage();
    await page.goto(ui);
    await page.locator('.library-card .song-item').first().waitFor();
    for (const width of [320,375,390,430]) {
      await page.setViewportSize({ width, height: 844 });
      const rows = await page.locator('.library-card .song-item').evaluateAll(cards => cards.map(card => {
        const copy = card.querySelector('.song-copy'), badges = card.querySelectorAll('.type-label');
        const rect = card.getBoundingClientRect(), badge = badges[0].getBoundingClientRect(), text = copy.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(copy);
        const lines = [...range.getClientRects()];
        return { title: copy.querySelector('strong').textContent, count: badges.length, type: badges[0].textContent, tag: badges[0].tagName,
          badgeWidth: badge.width, centered: Math.abs((rect.top + rect.bottom - badge.top - badge.bottom) / 2),
          rightPadding: rect.right - badge.right, gap: badge.left - text.right,
          textRight: Math.max(...lines.map(r => r.right)), badgeLeft: badge.left,
          textBottom: Math.max(...lines.map(r => r.bottom)), bottom: rect.bottom, top: rect.top,
          scroll: card.scrollWidth, width: card.clientWidth };
      }));
      assert.equal(rows.length, songs.length);
      for (const row of rows) {
        assert.equal(row.count, 1);
        assert.equal(row.type, songs.find(song => song.title === row.title).songType);
        assert.equal(row.tag, 'SPAN');
        assert(row.centered < 1, 'badge vertically centered');
        assert(row.badgeWidth < 64, 'compact badge');
        assert(Math.abs(row.rightPadding - 13) < 1, '12px padding plus border');
        assert(row.gap >= 11 && row.textRight < row.badgeLeft, 'reserved badge column');
        assert(row.textBottom <= row.bottom - 10, 'text inside card');
        assert(row.scroll <= row.width + 1, 'no horizontal overflow');
      }
      assert.equal(await page.locator('.filter-tabs .filter-tab').count(), 3);
      console.log('PASS one centered metadata badge, safe titles/authors and consistent padding at ' + width);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
