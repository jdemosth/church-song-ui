const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch();try{
 const context=await browser.newContext(),ui=process.env.EVENTS_TEST_URL||'http://127.0.0.1:5188';
 await context.route(`http://${new URL(ui).hostname}:8080/**`,r=>r.fulfill({json:new URL(r.request().url()).pathname==='/settings'?{churchName:'Test'}:[]}));
 const page=await context.newPage();await page.goto(ui);await page.getByRole('button',{name:'Notes',exact:true}).click();
 await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Unavailable','QuotaExceededError')}});
 await page.getByLabel('Note',{exact:true}).fill('Session-only note');await page.getByText(/Browser storage is unavailable/).waitFor();
 await page.getByRole('button',{name:'Song',exact:true}).click();await page.getByRole('button',{name:'Notes',exact:true}).click();
 assert.equal(await page.getByLabel('Note',{exact:true}).inputValue(),'Session-only note');
 assert(await page.getByRole('button',{name:'Send Note Live',exact:true}).isDisabled());
 await page.getByLabel('Note',{exact:true}).fill('line\n'.repeat(41));await page.getByText('Use up to 2000 characters and 40 lines per note.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Preview Note',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Review Note'});
 assert.equal(await dialog.locator('.note-proofread-text').textContent(),'line\n'.repeat(41));
 assert(await dialog.getByRole('button',{name:'Send Note Live',exact:true}).isDisabled());
 console.log('PASS unavailable storage preserves session draft without automatic preview/send; note line-limit validation');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
