const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const french = 'C’est pourquoi je vous dis : Ne vous inquiétez pas pour votre vie de ce que vous mangerez, ni pour votre corps de quoi vous serez vêtus. La vie n’est-elle pas plus que la nourriture, et le corps plus que le vêtement ?';
const english = 'Therefore I say unto you, Take no thought for your life, what ye shall eat, or what ye shall drink; nor yet for your body, what ye shall put on. Is not the life more than meat, and the body than raiment?';
(async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ hasTouch: true });
    const ui = process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5188';
    await context.route(`http://${new URL(ui).hostname}:8080/**`, async route => {
      const url = new URL(route.request().url()); let data = [];
      if (url.pathname === '/projector/capabilities') return route.fulfill({ status: 404, json: {} });
      if (url.pathname === '/settings') data = { churchName: 'Layout Test', defaultLanguage: 'FRENCH' };
      if (url.pathname === '/bible/translations') data = [{ code: 'LSG1910', name: 'French' }, { code: 'KJV', name: 'English' }];
      if (url.pathname === '/bible/books') data = [{ key: 'MATTHEW', name: 'Matthew', chapterCount: 6 }];
      if (url.pathname.endsWith('/metadata')) data = { availableVerseNumbers: [25,26,27] };
      if (url.pathname === '/bible/passage') data = { bookKey: 'MATTHEW', bookName: 'Matthew', chapter: 6, startVerse: 25, endVerse: 27, translationCode: url.searchParams.get('translation'), verses: [25,26,27].map(verseNumber => ({ verseNumber, text: url.searchParams.get('translation') === 'KJV' ? english : french })) };
      return route.fulfill({ json: data });
    });
    const page = await context.newPage();
    await page.goto(ui);
    await page.locator('.prepare-workspace-tab').getByText('Bible', { exact: true }).click();
    await page.getByRole('button', { name: 'Preview Passage', exact: true }).click();
    await page.locator('.bible-console-verse').first().waitFor();
    for (const width of [375,390,430]) {
      await page.setViewportSize({ width, height: 844 });
      for (const mode of ['Français', 'Français + English']) {
        // Prepare currently follows the reference language, independently of projection
        // mode. Stress-test its existing bilingual JSX shape without changing that logic.
        await page.locator('.bible-console-verse > span').evaluateAll((texts, { bilingual, french, english }) => {
          for (const text of texts) {
            text.className = bilingual ? 'bible-console-verse-stack' : '';
            if (bilingual) {
              const primary = document.createElement('span'), secondary = document.createElement('span');
              primary.textContent = french; secondary.textContent = english;
              text.replaceChildren(primary, secondary);
            } else text.textContent = french;
          }
        }, { bilingual: mode.includes('+'), french, english });
        const rows = await page.locator('.bible-console-verse').evaluateAll(cards => cards.map(card => {
          const rect = card.getBoundingClientRect(), text = card.querySelector(':scope > span'), box = text.getBoundingClientRect();
          const range = document.createRange(); range.selectNodeContents(text);
          const lines = [...range.getClientRects()];
          return { top: rect.top, bottom: rect.bottom, textTop: box.top, textBottom: Math.max(box.bottom, ...lines.map(r => r.bottom)), left: rect.left, right: rect.right, textRight: Math.max(...lines.map(r => r.right)), numberTop: card.querySelector('strong').getBoundingClientRect().top, scroll: card.scrollHeight, height: card.clientHeight };
        }));
        if (process.env.BIBLE_LAYOUT_AUDIT) { console.log(width, mode, rows); continue; }
        assert.equal(rows.length, 3);
        for (const [index,row] of rows.entries()) {
          assert(row.textTop >= row.top + 10, 'top padding');
          assert(row.textBottom <= row.bottom - 10, `text contained in card at ${width} ${mode}: ${JSON.stringify(row)}`);
          assert(row.textRight <= row.right - 10, 'text wraps within card');
          assert(Math.abs(row.numberTop - row.textTop) < 2, 'verse number top alignment');
          assert(row.scroll <= row.height + 1, 'no overflowing content');
          if (index) assert(row.top >= rows[index-1].bottom + 8, 'clear gap between verses');
        }
        console.log('PASS contained verse cards', width, mode);
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
