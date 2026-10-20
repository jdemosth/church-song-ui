// Real Spring WebSocket hub + production UI in isolated browser contexts.
// HTTP content fixtures and a disposable server database keep operational data untouched.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
(async () => {
  const root = path.resolve(__dirname, '..'), temp = fs.mkdtempSync(path.join(os.tmpdir(), 'church-network-'));
  const out = path.join(temp, 'ui');
  execFileSync('npm', ['run','build','--','--outDir',out], { cwd:root, stdio:'pipe' });
  const log = fs.openSync(path.join(temp,'server.log'),'w');
  const port = 18089;
  const host = process.env.NETWORK_TEST_HOST || '127.0.0.1';
  const server = spawn(process.env.JAVA || 'java', ['-jar',
    path.resolve(root,'../church-song-api/target/church-song-api-0.0.1-SNAPSHOT.jar'),
    ...(process.env.NETWORK_TEST_LAN_DEV ? ['--spring.profiles.active=lan-dev'] : []),
    '--server.address='+(process.env.NETWORK_TEST_MDNS ? '0.0.0.0' : host), '--server.port='+port,
    ...(process.env.NETWORK_TEST_MDNS ? ['--churchsong.discovery.enabled=true',
      '--churchsong.discovery.hostname='+process.env.NETWORK_TEST_MDNS] : []),
    '--spring.datasource.url=jdbc:sqlite:'+path.join(temp,'test.db'),
    '--churchsong.bible.storage-dir='+path.join(temp,'reference'),
    '--churchsong.media.storage-dir='+path.join(temp,'media'),
    '--spring.web.resources.static-locations='+require('node:url').pathToFileURL(out+'/').href,
    '--spring.jpa.show-sql=false'], { cwd:temp, stdio:['ignore',log,log] });
  let browser;
  try {
    for(let i=0;;i++) {
      try { const r=await fetch('http://'+host+':'+port+'/projector/capabilities'); if(r.ok)break; } catch {}
      if(i>160 || server.exitCode!==null) throw new Error('Network test server failed: '+fs.readFileSync(path.join(temp,'server.log'),'utf8').slice(-5000));
      await new Promise(r=>setTimeout(r,250));
    }
    if (process.env.NETWORK_TEST_MDNS) {
      const info=await (await fetch('http://'+host+':'+port+'/system/network')).json();
      assert.equal(info.application,'church-song-system');
      assert.equal(info.friendlyUrl,'http://'+host+':'+port);
      assert(info.addresses.length > 0);
    }
    // Verify real HTTP preflight and WebSocket handshake origin enforcement.
    const serverOrigin='http://'+host+':'+port;
    for (const origin of ['http://192.168.1.50:5173', 'http://10.20.30.40:5173', 'http://192.168.1.50:9999']) {
      const allowed=!!process.env.NETWORK_TEST_LAN_DEV && origin.endsWith(':5173');
      for (const endpoint of ['/songs', '/settings', '/projector/capabilities', '/system/network']) {
        const response=await fetch(serverOrigin+endpoint, {method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'PUT','Access-Control-Request-Headers':'content-type'}});
        assert.equal(response.headers.get('access-control-allow-origin'),allowed?origin:null);
      }
      const status=await new Promise((resolve,reject)=>{
        const request=require('node:http').request(serverOrigin+'/projector/ws',{headers:{Origin:origin,Connection:'Upgrade',Upgrade:'websocket','Sec-WebSocket-Version':'13','Sec-WebSocket-Key':'dGhlIHNhbXBsZSBub25jZQ=='}},response=>{response.resume();resolve(response.statusCode)});
        request.on('upgrade',(response,socket)=>{socket.destroy();resolve(response.statusCode)});
        request.on('error',reject);request.end();
      });
      assert.equal(status,allowed?101:403);
    }
    console.log('PASS real HTTP/WebSocket origin policy, lan-dev='+!!process.env.NETWORK_TEST_LAN_DEV);
    browser=await chromium.launch({headless:true});
    const errors=[], commands=[];
    const songs=[1,2].map(id=>({id,title:'Song '+id,language:'ENGLISH',lyrics:`[Verse 1]\nSong ${id} first section\n[Verse 2]\nSong ${id} second section\n[Verse 3]\nSong ${id} third section`,type:'SLOW'}));
    const events=Array.from({length:10},(_,i)=>({id:i+1,title:'Event '+(i+1),eventDate:'2099-09-17',startTime:'12:00',birthdayEntries:[]}));
    events.push({id:11,title:'September Birthdays',eventType:'BIRTHDAY_LIST',birthdayMonth:9,birthdayEntries:Array.from({length:10},(_,i)=>({name:'Person '+(i+1),month:9,day:i+1}))});
    let settings={churchName:'HMGA',churchAbbreviation:'HMGA',defaultLanguage:'ENGLISH',defaultBackground:'deep-blue',defaultServiceType:'SUNDAY'};
    async function client(host,projector=false) {
      const context=await browser.newContext(!projector && process.env.NETWORK_OPERATOR_WIDTH ? {
        viewport:{width:Number(process.env.NETWORK_OPERATOR_WIDTH),height:844},hasTouch:true,
      } : {});
      // Real WebSockets; BroadcastChannel disabled to prove server-mediated delivery.
      await context.addInitScript(()=>{delete window.BroadcastChannel});
      const origin='http://'+host+':'+port;
      await context.route(origin+'/**',async route=>{
        const url=new URL(route.request().url()),p=url.pathname;
        if(p.startsWith('/projector/') || p==='/notes' || p.startsWith('/notes/'))return route.continue();
        if(p==='/'||p.startsWith('/assets/')||p.endsWith('.svg'))return route.continue();
        let data=[];
        if(p==='/songs')data=songs;
        else if(p==='/events')data=events;
        else if(p==='/playlists')data=songs.map(song=>({id:song.id,name:'Playlist '+song.id,songs:[song],reusable:true}));
        else if(p==='/settings'){if(route.request().method()==='PUT')settings=route.request().postDataJSON();data=settings}
        else if(p.includes('melody-reference'))return route.fulfill({status:204});
        else if(p==='/bible/translations')data=[{code:'LSG1910',name:'French'},{code:'KJV',name:'English'}];
        else if(p==='/bible/books')data=[{key:'JOHN',name:'John',chapterCount:2}];
        else if(p.includes('/metadata'))data={bookKey:'JOHN',chapter:1,availableVerseNumbers:[1,2,3]};
        else if(p==='/bible/passage')data={bookKey:'JOHN',bookName:'John',chapter:1,startVerse:1,endVerse:3,translationCode:url.searchParams.get('translation'),verses:[1,2,3].map(verseNumber=>({verseNumber,text:'Bible verse '+verseNumber}))};
        return route.fulfill({json:data});
      });
      const page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));
      page.on('websocket',ws=>ws.on('framesent',f=>{if (!f.payload || typeof f.payload !== 'string') return; let msg;try {msg=JSON.parse(f.payload)} catch {return} if(msg.type==='COMMAND')commands.push(msg)}));
      // Keep a test-only handle for simulating a dropped socket, without replacing transport.
      await page.addInitScript(()=>{
        const Native=window.WebSocket;
        window.WebSocket=class extends Native {constructor(...args){super(...args);window.testSockets??=[];window.testSockets.push(this)}};
      });
      await page.goto(origin+(projector?'/?projector=1':''));
      await page.waitForFunction(()=>window.testSockets?.at(-1)?.readyState===1);
      await page.waitForTimeout(150);
      return {context,page,origin};
    }
    const windows=await client(host,true), remote=await client(host), second=await client(host);
    const p=windows.page,o=remote.page;
    const nav=(page,name)=>page.locator('nav.side-nav').getByRole('button',{name:new RegExp(name)}).click();
    const blank=async()=>{await p.waitForTimeout(200);assert.equal(await p.locator('.projector-screen').innerText(),'')};
    const shown=text=>p.getByText(text,{exact:true}).waitFor();
    async function prepare(id=1) {await nav(o,'Worship Console');await o.getByRole('button',{name:'Song',exact:true}).click();await o.locator('.playlist-select').selectOption(String(id));await o.locator('.right-console .current-heading h3').click()}
    if (host !== '127.0.0.1') assert.equal(await o.evaluate(()=>window.isSecureContext),false);
    if (process.env.BIBLE_RELEASE_ONLY) {
      await prepare();await o.getByRole('button',{name:'Bible',exact:true}).click();
      await require('./bibleProjectorLayout.cjs')(o,p,serverOrigin);
      await require('./hat1985Projection.cjs')(o,p,serverOrigin);
      await require('./trilingualBible.cjs')(o,p);
      assert.deepEqual(errors,[]);return;
    }
    await blank();
    await prepare(); await blank(); assert.equal(commands.length,0);
    await o.keyboard.press('Enter'); await shown('Song 1 first section');
    await o.keyboard.press('ArrowRight'); await shown('Song 1 second section');
    await o.keyboard.press('ArrowLeft'); await shown('Song 1 first section');
    await o.getByRole('button',{name:'Verse 3',exact:true}).click(); await shown('Song 1 third section');
    await p.keyboard.press('ArrowLeft');await shown('Song 1 second section');
    await o.locator('.right-console .current-heading h3').click();await o.keyboard.press('b');
    await p.locator('.projector-screen.black').waitFor();
    await o.keyboard.press('b');await shown('Song 1 second section');
    await o.keyboard.press('c');await blank();await o.keyboard.press('c');await shown('Song 1 second section');
    const beforeReload=commands.length;
    await o.reload();await o.waitForTimeout(400);await shown('Song 1 second section');
    await prepare(2);await o.keyboard.press('ArrowRight');await shown('Song 1 second section');
    assert.equal(commands.length,beforeReload,'Reload/preparation must emit no commands');
    await o.keyboard.press('Enter');await shown('Song 2 second section');
    // Operator transport loss and recovery retain live frame and do not resend.
    const beforeDrop=commands.length;
    await o.evaluate(()=>window.testSockets.at(-1).close());await o.waitForTimeout(1900);
    await shown('Song 2 second section');assert.equal(commands.length,beforeDrop);
    // Projector transport loss retains frame; reconnection does not restore stale snapshots.
    await p.evaluate(()=>window.testSockets.at(-1).close());await p.waitForTimeout(1900);
    await shown('Song 2 second section');
    await o.keyboard.press('Enter');await shown('Song 2 second section');
    // Fresh projector document starts blank even while other clients hold live state.
    await p.reload();await blank();
    await o.keyboard.press('ArrowRight');await blank();
    await o.keyboard.press('Enter');await shown('Song 2 third section');
    await nav(o,'Upcoming Events');await o.getByRole('button',{name:'Send to Projector',exact:true}).click();await shown('Event 1');
    await p.reload();await blank();await o.getByRole('button',{name:'Send to Projector',exact:true}).click();await shown('Event 1');
    await o.locator('.event-card h3').first().click();await o.keyboard.press('ArrowRight');await shown('Event 5');
    await o.keyboard.press('ArrowRight');await shown('Event 9');await o.keyboard.press('ArrowRight');await shown('Event 9');
    await o.keyboard.press('ArrowLeft');await shown('Event 5');
    await nav(second.page,'Upcoming Events');await second.page.getByText(/Events — Page 2 of 3/).waitFor();
    await second.page.locator('.event-card h3').first().click();await second.page.keyboard.press('b');await p.locator('.projector-screen.black').waitFor();await second.page.keyboard.press('b');await shown('Event 5');
    await o.locator('.header-right select').selectOption('11');await o.getByRole('button',{name:'Send to Projector',exact:true}).click();await shown('Person 1');
    await p.reload();await blank();await o.getByRole('button',{name:'Send to Projector',exact:true}).click();await shown('Person 1');
    await p.keyboard.press('ArrowDown');await shown('Person 9');await p.keyboard.press('ArrowUp');await shown('Person 1');
    await prepare();await o.getByRole('button',{name:'Bible',exact:true}).click();await o.getByRole('button',{name:'Preview Passage',exact:true}).click();await o.locator('.bible-console-verse').first().waitFor();
    await o.locator('.right-console .current-heading h3').click();await o.keyboard.press('Enter');await p.getByText('Bible verse 1',{exact:false}).first().waitFor();
    await p.reload();await blank();await o.keyboard.press('Enter');await p.getByText('Bible verse 1',{exact:false}).first().waitFor();
    await o.keyboard.press('ArrowDown');await p.getByText('Bible verse 2',{exact:false}).first().waitFor();
    await require('./releaseProjectionScenarios.cjs')(o,p);
    await nav(o,'Settings');await o.locator('select[name="defaultBackground"]').selectOption('sunrise');await o.getByRole('button',{name:'Save Settings',exact:true}).click();
    await prepare();await o.keyboard.press('Enter');await p.locator('.projector-screen-sunrise').waitFor();
    // Exercise portable custom-background bytes through the real protocol, not a local blob URL.
    await o.evaluate(async()=>{
      const socket=new WebSocket(location.origin.replace(/^http/,'ws')+'/projector/ws');
      await new Promise((resolve,reject)=>{
        socket.onopen=()=>socket.send(JSON.stringify({type:'HELLO',role:'OPERATOR'}));
        socket.onerror=reject;
        socket.onmessage=event=>{
          const message=JSON.parse(event.data);
          if(message.type==='WELCOME')socket.send(JSON.stringify({type:'COMMAND',epoch:message.epoch,
            connection:message.connection,sequence:1,action:'BACKGROUND_CHANGE',payload:{backgroundType:'custom',
              customBackgroundId:'network-test-image',customBackgroundName:'pixel.png',
              customBackgroundData:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='}}));
          if(message.type==='STATE'&&message.action==='BACKGROUND_CHANGE'){socket.close();resolve()}
          if(message.type==='ERROR'){socket.close();reject(new Error(message.message))}
        };
      });
    });
    await p.waitForFunction(()=>document.querySelector('.projector-screen')?.style.backgroundImage.includes('data:image/png;base64,'));
    await nav(second.page,'Worship Console');await second.page.locator('.playlist-select').selectOption('1');
    await second.page.waitForFunction(()=>document.querySelector('.right-console .projector-screen')?.style.backgroundImage.includes('data:image/png;base64,'));
    await require('./operatorFeatureScenarios.cjs')(o,p);
    await require('./notesArchiveScenarios.cjs')(o,p);
    const sharedNotes=await (await second.page.request.get(second.origin+'/notes?q=Archive')).json();
    assert(sharedNotes.some(note=>note.title==='Long teaching archive'),'saved archive is shared through the real application database');
    await prepare();await o.getByRole('button',{name:'Bible',exact:true}).click();await o.getByRole('button',{name:'Preview Passage',exact:true}).click();await o.locator('.bible-console-verse').first().click();await o.locator('.bible-live-nav-buttons').getByRole('button',{name:'Send to Projector',exact:true}).click();await p.getByText('Bible verse 1',{exact:false}).first().waitFor();await o.getByLabel('Live verse number',{exact:true}).fill('2');await o.getByLabel('Live verse number',{exact:true}).press('Enter');await p.getByText('Bible verse 2',{exact:false}).first().waitFor();
    // Freeze both renderer event loops beyond the old 30s JS-heartbeat expiry.
    // Native WebSocket Ping/Pong must keep the same underlying connections alive.
    const counts=await Promise.all([o,p].map(page=>page.evaluate(()=>window.testSockets.length)));
    const sessions=await Promise.all([o,p].map(page=>page.context().newCDPSession(page)));
    for (const session of sessions) await session.send('Page.setWebLifecycleState',{state:'frozen'});
    await new Promise(resolve=>setTimeout(resolve,35000));
    for (const session of sessions) await session.send('Page.setWebLifecycleState',{state:'active'});
    await o.waitForTimeout(2500);
    assert.deepEqual(await Promise.all([o,p].map(page=>page.evaluate(()=>window.testSockets.length))),counts,'35s frozen browsers do not expire/recreate sockets');
    assert(await o.evaluate(()=>window.testSockets.at(-1).readyState===1));
    assert(await p.evaluate(()=>window.testSockets.at(-1).readyState===1));
    await p.getByText('Bible verse 2',{exact:false}).first().waitFor();
    console.log('PASS extended connection session and 35-second frozen operator/projector: same sockets, current display preserved');
    await require('./bibleProjectorLayout.cjs')(o,p,serverOrigin);
    await require('./hat1985Projection.cjs')(o,p,serverOrigin);
    await require('./trilingualBible.cjs')(o,p);
    await remote.context.close();await p.locator('.bible-projector-verse').first().waitFor();
    assert.equal(await windows.context.pages().length,1,'Remote send does not open duplicate projector');
    assert.deepEqual(errors,[]);
    console.log('PASS real WebSocket cross-context Songs/Bible/Events/Birthdays, navigation, controls, backgrounds, multiple operators, disconnect/reconnect, operator reload continuity and projector refresh safety');
  } finally {
    if(browser)await browser.close();
    server.kill('SIGTERM');
    await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);setTimeout(resolve,5000).unref()});
    fs.closeSync(log);
    // Retain only on failure for diagnostic inspection; no operational data is used.
    console.log('Network test diagnostics: '+temp);
  }
})().catch(error=>{console.error(error);process.exitCode=1});
