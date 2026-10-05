// Run with a local Vite server and Playwright (or PLAYWRIGHT_MODULE).
// API responses are mocked; saved Events are never changed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const context=await browser.newContext();
  // Keep the requested 2026 examples upcoming regardless of the test run date.
  await context.clock.install({ time: new Date('2026-09-14T12:00:00Z') });
  let events=[];
  await context.route(`http://${new URL(process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178').hostname}:8080/**`,r=>r.fulfill({json:r.request().url().endsWith('/events')?events:[]}));
  const operator=await context.newPage();await operator.goto((process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178'));
  await operator.getByRole('button',{name:/Upcoming Events/}).click();
  const projector=await context.newPage();await projector.goto(`${process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178'}/?projector=1`);
  for(const [start,end,expected] of [
   ['2026-11-12','2026-11-14','NOV 12 - 14, 2026'],
   ['2026-09-17',null,'SEP 17, 2026'],
   ['2026-09-17','2026-09-20','SEP 17 - 20, 2026'],
   ['2026-09-30','2026-10-02','SEP 30 - OCT 2, 2026'],
   ['2026-12-31','2027-01-02','DEC 31, 2026 - JAN 2, 2027'],
  ]) {
   events=[{id:1,title:'Convention',eventDate:start,endDate:end,startTime:'11:00',birthdayEntries:[]}];
   await operator.getByRole('button',{name:'Send to Projector',exact:true}).click();
   await operator.getByRole('button',{name:'Send to Projector',exact:true}).waitFor();
   await projector.waitForFunction(expected=>document.querySelector('.event-projection-date')?.innerText===expected,expected);
   const snapshot=await operator.evaluate(()=>JSON.parse(localStorage.getItem('church-song-projector-state')));
   assert.equal(snapshot.projectedEvents[0].endDate,end);
   assert.equal(snapshot.projectedEvents[0].eventDate,start);
   assert.equal(await projector.locator('.event-projection-title').innerText(),'Convention');
   assert((await operator.locator('.event-card').innerText()).toUpperCase().includes(expected));
   assert.equal(await projector.locator('.events-page-status').count(),0);
   console.log('PASS payload, management, public projector:',expected);
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
