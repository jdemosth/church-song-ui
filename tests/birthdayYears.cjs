// Run with a local Vite server and Playwright (or PLAYWRIGHT_MODULE).
// API fixtures isolate browser tests; backend integration tests verify storage.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    let saved = null;
    await context.route(`http://${new URL(process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178').hostname}:8080/**`, route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (!path.startsWith('/events')) return route.fulfill({ json: [] });
      if (request.method() === 'POST' || request.method() === 'PUT') saved = { ...request.postDataJSON(), id: 1 };
      return route.fulfill({ json: request.method() === 'GET' ? (saved ? [saved] : []) : saved });
    });
    const operator = await context.newPage();
    await operator.goto(process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178');
    const openEvents = () => operator.getByRole('button', { name: /Upcoming Events/ }).click();
    await openEvents();
    await operator.getByRole('button', { name: '+ Add Event', exact: true }).first().click();
    await operator.locator('.modal select').first().selectOption('BIRTHDAY_LIST');
    await operator.locator('.birthday-editor select').selectOption('9');
    await operator.getByLabel('Display Year (optional)', { exact: true }).fill('2026');
    for (const [name, day, year] of [['Kephtania Alezie', '12', '1995'], ['Jean Kennedy Demosthene', '28', '1965'], ['Marie Pierre', '30', '']]) {
      await operator.getByRole('button', { name: '+ Add Birthday', exact: true }).click();
      const row = operator.locator('.birthday-editor-row').last();
      await row.getByLabel('Name', { exact: true }).fill(name);
      await row.getByLabel('September Day', { exact: true }).fill(day);
      await row.getByLabel('Birth Year (optional)', { exact: true }).fill(year);
    }
    await operator.getByRole('button', { name: 'Add Event', exact: true }).click();
    await operator.locator('.birthday-summary').waitFor();
    assert.deepEqual(saved.birthdayEntries.map(person => person.birthYear), [1995, 1965, null]);
    await operator.reload(); await openEvents();
    const expected = ['Sep 12, 1995', 'Sep 28, 1965', 'Sep 30'];
    const preview = await operator.locator('.birthday-summary li').allTextContents();
    expected.forEach((date, index) => assert(preview[index].endsWith(date)));
    await operator.locator('.header-right select').selectOption('1');
    const popup = context.waitForEvent('page');
    await operator.getByRole('button', { name: 'Send to Projector', exact: true }).click();
    const projector = await popup;
    await projector.locator('.birthday-date').first().waitFor();
    assert.deepEqual(await projector.locator('.birthday-date').allTextContents(), expected);
    const state = await operator.evaluate(() => JSON.parse(localStorage.getItem('church-song-projector-state')));
    assert.deepEqual(state.projectedEvents[0].birthdayEntries.map(person => person.birthYear), [1995, 1965, null]);
    assert.equal(state.projectedEvents[0].displayYear, 2026);
    await operator.getByRole('button', { name: 'Edit', exact: true }).click();
    const year = operator.locator('.birthday-editor-row').first().getByLabel('Birth Year (optional)', { exact: true });
    assert.equal(await year.inputValue(), '1995');
    await year.fill('2001');
    await operator.getByRole('button', { name: 'Save Event', exact: true }).click();
    await operator.getByText('Kephtania Alezie — Sep 12, 2001', { exact: true }).waitFor();
    assert.equal(await projector.locator('.birthday-date').first().innerText(), 'Sep 12, 1995');
    await operator.reload(); await openEvents();
    await operator.getByText('Kephtania Alezie — Sep 12, 2001', { exact: true }).waitFor();
    await operator.locator('.header-right select').selectOption('1');
    await operator.getByRole('button', { name: 'Send to Projector', exact: true }).click();
    await projector.getByText('Sep 12, 2001', { exact: true }).waitFor();
    assert.equal(await projector.locator('.birthday-date').last().innerText(), 'Sep 30');
    console.log('PASS: create/save/reload, exact per-person dates, immutable payload, edit persistence, explicit resend, no displayYear fallback.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
