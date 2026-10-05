// Network information must remain read-only and never issue a projector command.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext();
    let fail = false, conflict = false, ip = '192.168.5.10';
    const writes = [], errors = [];
    await context.route(`http://${new URL(process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178').hostname}:8080/**`, async route => {
      const req = route.request(), p = new URL(req.url()).pathname;
      if (req.method() !== 'GET') writes.push(p);
      if (p === '/system/network') {
        if (fail) return route.fulfill({status:503,json:{}});
        return route.fulfill({json:{application:'church-song-system',ready:true,
          state:conflict?'conflict':'advertising',friendlyUrl:conflict?'':'http://churchsongs.local:8080',
          message:conflict?'The local name is already in use.':'Bookmark this address on the Mac.',
          addresses:[{interfaceName:'lan',adapter:'Church Ethernet',url:`http://${ip}:8080`}]}});
      }
      if (p === '/settings') return route.fulfill({json:{churchName:'HMGA',churchAbbreviation:'HMGA',defaultLanguage:'ENGLISH',defaultBackground:'sky-field',defaultServiceType:'Sunday'}});
      if (p === '/projector/capabilities') return route.fulfill({status:404,json:{}});
      return route.fulfill({json:[]});
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178');
    await page.getByRole('button',{name:/Settings/}).first().click();
    const panel=page.getByRole('region',{name:'Connect another computer'});
    await panel.getByRole('link',{name:'http://churchsongs.local:8080',exact:true}).waitFor();
    await panel.getByRole('link',{name:'http://192.168.5.10:8080',exact:true}).waitFor();
    ip='192.168.5.20'; await panel.getByRole('button',{name:'Refresh network addresses'}).click();
    await panel.getByRole('link',{name:'http://192.168.5.20:8080',exact:true}).waitFor();
    assert.equal(await panel.getByRole('link',{name:'http://192.168.5.10:8080',exact:true}).count(),0);
    fail=true; await panel.getByRole('button',{name:'Refresh network addresses'}).click();
    await panel.getByText(/Could not refresh network addresses/).waitFor();
    assert.equal(await panel.getByRole('link').count(),0,'Do not suggest stale addresses after failed refresh');
    fail=false; conflict=true; await panel.getByRole('button',{name:'Refresh network addresses'}).click();
    await panel.getByText('The local name is already in use.').waitFor();
    assert.equal(await panel.getByRole('link',{name:'http://churchsongs.local:8080',exact:true}).count(),0);
    await panel.getByRole('link',{name:'http://192.168.5.20:8080',exact:true}).waitFor();
    assert.deepEqual(writes,[]); assert.deepEqual(errors,[]);
    console.log('PASS network panel: friendly URL, DHCP refresh, failure/conflict fallback, no mutations');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
