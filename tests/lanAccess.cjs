// Production build at a non-localhost HTTP origin. API fixtures represent one
// shared server; separate browser contexts represent Windows and Mac clients.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
(async () => {
 const root=path.resolve(__dirname,'..'), out=fs.mkdtempSync(path.join(os.tmpdir(),'hmga-lan-ui-'));
 let browser;
 try {
  execFileSync(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build','--outDir',out],{cwd:root,stdio:'pipe'});
  for(const file of fs.readdirSync(path.join(out,'assets')).filter(f=>f.endsWith('.js')))assert(!fs.readFileSync(path.join(out,'assets',file),'utf8').includes('http://localhost:8080'));
  browser=await chromium.launch({headless:true});
  const requests=[], errors=[];
  let songs=[{id:1,title:'Shared Song',language:'ENGLISH',songType:'SLOW',lyrics:'[Verse 1]\nShared first verse\n[Verse 2]\nShared second verse'}];
  let events=[{id:1,title:'Shared Event',eventDate:'2099-09-17',startTime:'19:30',birthdayEntries:[]},{id:2,eventType:'BIRTHDAY_LIST',birthdayMonth:9,birthdayEntries:[{name:'Shared Birthday',month:9,day:12,birthYear:1995}]}];
  let settings={churchName:'HMGA',churchAbbreviation:'HMGA',defaultLanguage:'ENGLISH',defaultBackground:'deep-blue',defaultServiceType:'Sunday Morning'};
  async function client(origin){
   const context=await browser.newContext();
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!==origin){errors.push('Wrong request origin: '+url.href);return route.abort()}
    const p=url.pathname,method=req.method();
    if(p==='/'||p.startsWith('/assets/')||p.endsWith('.svg')){
     const file=path.join(out,p==='/'?'index.html':p.slice(1));
     return route.fulfill({path:file,contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.svg')?'image/svg+xml':'text/html'});
    }
    requests.push({origin,path:p,method});let data=[];
    if(p==='/projector/capabilities')data={}; // Legacy-server fallback is intentionally exercised here.
    else if(p==='/system/network')data={application:'church-song-system',ready:true,state:'disabled',friendlyUrl:'',message:'Discovery disabled in fixture.',addresses:[]};
    else if(p==='/songs') {if(method==='POST'){const song={...req.postDataJSON(),id:2};songs.push(song);data=song}else data=songs}
    else if(p==='/songs/2'&&method==='PUT'){songs=songs.map(s=>s.id===2?{...s,...req.postDataJSON()}:s);data=songs[1]}
    else if(p==='/playlists')data=[{id:1,name:'Shared Service',songs:[songs[0]],reusable:true}];
    else if(p==='/service-plans')data=[{id:1,serviceName:'Shared History',serviceDate:'2026-09-01',status:'COMPLETED',songs:[]}];
    else if(p==='/events'){if(method==='POST'){const event={...req.postDataJSON(),id:3};events.push(event);data=event}else data=events}
    else if(p==='/settings'){if(method==='PUT')settings=req.postDataJSON();data=settings}
    else if(p.endsWith('/melody-reference'))data={audioUrl:'/songs/1/melody-reference/audio',originalFilename:'reference.wav',mimeType:'audio/wav'};
    else if(p.endsWith('/melody-reference/audio')){
     const wav=Buffer.alloc(46);wav.write('RIFF');wav.writeUInt32LE(38,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(2,40);
     return route.fulfill({body:wav,contentType:'audio/wav'});
    }
    else if(p==='/bible/translations')data=[{code:'LSG1910',name:'French'},{code:'KJV',name:'English'}];
    else if(p==='/bible/books')data=[{key:'JOHN',name:'John',chapterCount:2}];
    else if(p.includes('/metadata'))data={bookKey:'JOHN',chapter:1,availableVerseNumbers:[1,2]};
    else if(p==='/bible/passage')data={bookKey:'JOHN',bookName:'John',chapter:1,startVerse:1,endVerse:2,translationCode:url.searchParams.get('translation'),verses:[1,2].map(verseNumber=>({verseNumber,text:'Shared Bible '+verseNumber}))};
    else if(p==='/admin/backup/database')return route.fulfill({body:Buffer.from('fixture backup'),contentType:'application/x-sqlite3'});
    else {errors.push('Unexpected API request: '+method+' '+p);return route.fulfill({status:404,json:{message:'Missing fixture'}})}
    await route.fulfill({json:data});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);return {context,page};
  }
  const windows=await client('http://localhost:8080');
  await windows.page.locator('.playlist-select').selectOption('1');
  const projector=await windows.context.newPage();await projector.goto('http://localhost:8080/?projector=1');
  await windows.page.locator('.right-console .current-heading h3').click();await windows.page.keyboard.press('Enter');await projector.getByText('Shared first verse',{exact:true}).waitFor();
  const liveText=await projector.locator('.projector-screen').innerText();
  const mac=await client('http://hmga-server.test:8080');const page=mac.page;
  assert.equal(await page.evaluate(()=>window.isSecureContext),false);
  const nav=name=>page.locator('nav.side-nav').getByRole('button',{name:new RegExp(name)}).click();
  await nav('Songs');await page.getByRole('button',{name:'+ New Song',exact:true}).click();
  await page.locator('.modal').getByLabel('Title',{exact:true}).fill('Created from Mac');await page.locator('.modal').getByLabel('Lyrics',{exact:true}).fill('[Verse 1]\nLAN lyrics');await page.getByRole('button',{name:'Add Song',exact:true}).click();await page.locator('.modal-overlay').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Edit Song',exact:true}).click();await page.locator('.modal').getByLabel('Title',{exact:true}).fill('Updated from Mac');await page.getByRole('button',{name:'Save Changes',exact:true}).click();await page.locator('.modal-overlay').waitFor({state:'hidden'});
  await nav('Playlists');await nav('Service History');await nav('Upcoming Events');assert.equal(await page.locator('.event-card').count(),2);
  await page.getByRole('button',{name:'+ Add Event',exact:true}).click();await page.getByLabel('Title *',{exact:true}).fill('LAN Event');await page.getByLabel('Start Date *',{exact:true}).fill('2099-09-18');await page.getByLabel('Start Time *',{exact:true}).fill('19:30');await page.getByRole('button',{name:'Add Event',exact:true}).click();await page.locator('.modal-overlay').waitFor({state:'hidden'});
  await nav('Settings');await page.locator('select[name="defaultBackground"]').selectOption('sunrise');await page.getByRole('button',{name:'Save Settings',exact:true}).click();await page.getByText('Settings saved successfully.',{exact:true}).waitFor();
  await nav('Worship Console');await page.locator('.playlist-select').selectOption('1');await page.getByRole('button',{name:'Learning Mode Off',exact:true}).click();await page.locator('audio.learning-audio-element').waitFor({state:'attached'});assert.equal(await page.locator('audio.learning-audio-element').getAttribute('src'),'/songs/1/melody-reference/audio');
  await page.waitForRequest(r=>r.url().endsWith('/melody-reference/audio'),{timeout:1000}).catch(()=>assert(requests.some(r=>r.origin==='http://hmga-server.test:8080'&&r.path.endsWith('/melody-reference/audio'))));
  await page.getByRole('button',{name:'Bible',exact:true}).click();await page.getByRole('button',{name:'Preview Passage',exact:true}).click();await page.locator('.bible-console-verse').first().waitFor();
  await nav('Backup & Export');await page.getByRole('button',{name:'Download Database Backup',exact:true}).click();
  assert.equal(await projector.locator('.projector-screen').innerText(),liveText);
  // Normal reload reads the common server state; it does not resend live content.
  await windows.page.reload();await windows.page.locator('nav.side-nav').getByRole('button',{name:/Songs/}).click();await windows.page.getByText('Updated from Mac',{exact:true}).first().waitFor();assert.equal(await projector.locator('.projector-screen').innerText(),liveText);
  await windows.page.locator('.songs-management-grid .song-item').filter({hasText:'Updated from Mac'}).click();await windows.page.getByRole('button',{name:'Edit Song',exact:true}).click();await windows.page.locator('.modal').getByLabel('Title',{exact:true}).fill('Updated from Windows');await windows.page.getByRole('button',{name:'Save Changes',exact:true}).click();await windows.page.locator('.modal-overlay').waitFor({state:'hidden'});
  await page.reload();await nav('Songs');await page.getByText('Updated from Windows',{exact:true}).first().waitFor();
  const macRequests=requests.filter(r=>r.origin==='http://hmga-server.test:8080');
  for(const [method,p] of [['GET','/songs'],['POST','/songs'],['PUT','/songs/2'],['GET','/playlists'],['GET','/service-plans'],['GET','/events'],['POST','/events'],['GET','/settings'],['PUT','/settings'],['GET','/bible/passage'],['GET','/songs/1/melody-reference/audio'],['GET','/admin/backup/database']])assert(macRequests.some(r=>r.method===method&&r.path===p),method+' '+p);
  assert.deepEqual(errors,[]);
  console.log('PASS production non-localhost API/media routing, song create/update, Events/Birthdays, settings, playlists/history, Bible, backup, shared-server reloads and Windows projector isolation');
 }finally{if(browser)await browser.close();fs.rmSync(out,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exit(1)});
