const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ hasTouch: true });
    const ui = process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5188';
    const events = ['SERVICE','MEETING','YOUTH','CONFERENCE','SPECIAL_EVENT','OTHER'].map((eventType, index) => ({
      id: index + 1, eventType, title: index % 2 ? 'A very long church event title that wraps over several lines on a narrow phone' : 'Prayer',
      eventDate: '2099-09-17', startTime: '19:30', birthdayEntries: [],
      ...(index % 2 ? { hostName: 'Pastor Jean and the International Community Worship Leadership Team', location: '12345 LongUnbrokenStreetNameThatMustWrapInsideTheContentColumn, Community Centre, Main Auditorium', description: 'Everyone is invited to join this special evening of worship and fellowship.', endTime: '21:30' } : {}),
    }));
    events.push({ id: 7, eventType: 'BIRTHDAY_LIST', birthdayMonth: 9, birthdayEntries: [{ name: 'A very long birthday participant name for the wrapping test', month: 9, day: 17 }] });
    await context.route(`http://${new URL(ui).hostname}:8080/**`, route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/projector/capabilities') return route.fulfill({ status: 404, json: {} });
      return route.fulfill({ json: path === '/events' ? events : path === '/settings' ? { churchName: 'Layout Test' } : [] });
    });
    const page = await context.newPage();
    await page.goto(ui);
    await page.getByRole('button', { name: /Upcoming Events/ }).click();
    await page.locator('.event-card').first().waitFor();
    for (const width of [320,375,390,430,768,1280]) {
      await page.setViewportSize({ width, height: 844 });
      const cards = await page.locator('.event-card').evaluateAll(nodes => nodes.map(card => {
        const rect = card.getBoundingClientRect(), content = card.firstElementChild.getBoundingClientRect();
        const buttons = [...card.querySelectorAll('.event-actions button')].map(button => {
          const r = button.getBoundingClientRect();
          return { text: button.textContent, width: r.width, height: r.height, left: r.left, right: r.right, top: r.top - rect.top, bottom: r.bottom - rect.top };
        });
        const range = document.createRange(); range.selectNodeContents(card.firstElementChild);
        return { display: getComputedStyle(card).display, right: rect.right, contentRight: content.right, textRight: Math.max(...[...range.getClientRects()].map(r => r.right)), buttons, scroll: card.scrollWidth, width: card.clientWidth };
      }));
      assert.equal(cards.length, 7);
      if (width > 600) {
        assert(cards.every(card => card.display === 'flex'), 'existing tablet/desktop card layout retained');
        continue;
      }
      const reference = cards[0].buttons;
      for (const card of cards) {
        const [edit, del] = card.buttons;
        assert.deepEqual(card.buttons.map(button => button.text), ['Edit', 'Delete']);
        for (const [index,button] of card.buttons.entries()) {
          assert.equal(button.width, 88); assert.equal(button.height, 44);
          assert.equal(button.left, reference[index].left); assert.equal(button.top, reference[index].top);
          assert(button.right < card.right, 'buttons inside border');
        }
        assert.equal(del.top - edit.bottom, 8);
        assert(card.contentRight <= edit.left - 12, 'separate content/action columns');
        assert(card.textRight <= edit.left - 11, 'wrapped text never enters action column');
        assert(card.scroll <= card.width + 1, 'no card overflow');
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no page overflow');
      console.log('PASS consistent Edit/Delete geometry across seven event categories at ' + width);
    }
    console.log('PASS existing tablet/desktop layout retained');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
