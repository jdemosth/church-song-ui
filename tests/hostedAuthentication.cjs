const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch();
 try {
  const context = await browser.newContext(); let authenticated = false, selected = 1, deny = false, providerLogout = false;
  const ui = process.env.EVENTS_TEST_URL; let csrfRequests = 0, mutations = 0, sockets = 0;
  await context.addInitScript(() => localStorage.setItem('legacy-draft', 'Preserved standalone draft'));
  await context.route(`http://${new URL(ui).hostname}:8080/**`, async route => {
   const req = route.request(), path = new URL(req.url()).pathname;
   const headers = { 'access-control-allow-origin': ui, 'access-control-allow-credentials': 'true' };
   const send = (json, status = 200) => route.fulfill({ status, json, headers });
   if (req.method() === 'OPTIONS') return route.fulfill({ headers: { ...headers, 'access-control-allow-methods': 'GET,POST,PUT,DELETE', 'access-control-allow-headers': 'content-type,x-csrf-token,x-boc-church' } });
   if (path === '/auth/session') return send({ mode: 'hosted', development: true, authorized: authenticated, ...(authenticated ? { userId: 5, churchId: selected, email: 'fixture@test.invalid', churches: [{ id: 1, name: 'First church' }, { id: 2, name: 'Second church' }] } : {}) });
   if (path === '/auth/csrf') { csrfRequests++; return send({ token: 'fixture-csrf', headerName: 'X-CSRF-TOKEN' }); }
   if (!['GET','HEAD'].includes(req.method())) { assert.equal(req.headers()['x-csrf-token'], 'fixture-csrf'); mutations++; }
   if (path === '/auth/development-login') { authenticated = true; return route.fulfill({ status: 204, headers }); }
   if (path === '/auth/logout') { authenticated = false; return route.fulfill({ status: 204, headers: { ...headers, ...(providerLogout ? {'X-BOC-Logout-URL':'https://login.example.org/logout?client_id=fixture', 'Access-Control-Expose-Headers':'X-BOC-Logout-URL'} : {}) } }); }
   if (path === '/auth/church') { selected = req.postDataJSON().churchId; return send({}); }
   if (deny) return send({ message: 'Access denied' }, 403);
   if (path === '/projector/sessions') return send([{id:'fixture-session-'+selected,name:'Fixture session'}]);
   if (path === '/projector/capabilities') return send({available:false});
   if (path.endsWith('/tickets')) return send({message:'No live projector in this authentication fixture'},403);
   if (path === '/settings') return send({ churchName: 'Church '+selected, churchAbbreviation: 'TEST', defaultLanguage: 'ENGLISH', defaultBackground: 'black', defaultServiceType: 'Sunday Morning' });
   if (path === '/notes/count') return send(0);
   return send([]);
  });
  const page = await context.newPage(); page.on('websocket', socket => { if (new URL(socket.url()).pathname === '/projector/ws') sockets++ });
  await page.goto(ui); await page.getByRole('heading', { name: 'Invitation-only access' }).waitFor();
  await page.getByLabel('Email', { exact: true }).fill('fixture@test.invalid'); await page.getByLabel('Password', { exact: true }).fill('disposable-fixture');
  await page.getByRole('button', { name: 'Development sign in' }).click(); await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor();
  await page.getByRole('button',{name:'Fixture session',exact:true}).click();
  await page.getByLabel('Church',{exact:true}).waitFor();
  await page.evaluate(async () => { const {scopedStorage} = await import('/src/browserScope.js'); scopedStorage.setItem('draft', 'First church only'); const {saveBackgroundImage} = await import('/src/backgroundStorage.js'); await saveBackgroundImage({id:'fixture',file:new File(['first'], 'first.png', {type:'image/png'})}); });
  await page.getByLabel('Church', { exact: true }).selectOption('2'); await page.getByRole('button',{name:'Fixture session',exact:true}).click(); await page.waitForFunction(() => document.querySelector('[aria-label="Church"]')?.value === '2');
  assert.equal(await page.evaluate(async () => (await import('/src/browserScope.js')).scopedStorage.getItem('draft')), null);
  assert.equal(await page.evaluate(async () => (await import('/src/backgroundStorage.js')).loadLatestBackgroundImage()), null);
  assert.equal(await page.evaluate(() => localStorage.getItem('boc:u5:c1:pfixture-session-1:draft')), 'First church only');
  assert.equal(await page.evaluate(() => localStorage.getItem('legacy-draft')), 'Preserved standalone draft');
  deny = true; await page.evaluate(() => fetch('http://'+location.hostname+':8080/notes')); await page.getByRole('heading', {name:'Access denied'}).waitFor();
  deny = false; const logout = page.waitForResponse(r => r.url().endsWith('/auth/logout')); await page.getByRole('button', {name:'Sign out',exact:true}).click(); assert.equal((await logout).status(), 204); await page.getByRole('button', {name:'Sign out',exact:true}).waitFor({state:'hidden'}); await page.getByRole('button', {name:'Development sign in'}).waitFor();
  // Provider logout must be a browser navigation after the CSRF-protected local POST.
  providerLogout = true;
  await context.route('https://login.example.org/**', route => route.fulfill({contentType:'text/html',body:'<h1>Provider logout fixture</h1>'}));
  await page.getByLabel('Email', {exact:true}).fill('fixture@test.invalid');
  await page.getByLabel('Password', {exact:true}).fill('disposable-fixture');
  await page.getByRole('button', {name:'Development sign in'}).click();
  await page.getByRole('button', {name:'Sign out',exact:true}).click();
  await page.waitForURL('https://login.example.org/logout?client_id=fixture');
  assert.equal(authenticated, false);
  await page.getByRole('heading', {name:'Provider logout fixture'}).waitFor();
  console.log('PASS provider logout navigates browser only after local session logout');
  assert(csrfRequests >= 2); assert(mutations >= 3); assert.equal(sockets, 0);
  console.log('PASS hosted login, CSRF headers, church switch, isolated drafts/backgrounds, preserved legacy storage, access denied, logout, disabled global projector');
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
