// Disposable API fixtures; layout checks also exercise the existing safe operator controls.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const out=process.env.RESPONSIVE_OUTPUT || '/private/tmp/hmga-responsive';
fs.mkdirSync(out,{recursive:true});
const sizes=[[1920,1080],[1440,900],[1280,800],[1024,768],[768,1024],[1024,600],[430,932],[390,844],[360,740],[320,740],[932,430],[844,390],[740,360]];
const title='Grace and Peace for Every Generation WithALongUnbrokenTitleToCheckWrapping';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
 const context=await browser.newContext({hasTouch:!!process.env.RESPONSIVE_TOUCH}); const errors=[];
 const songs=Array.from({length:18},(_,i)=>({id:i+1,title:i===0?title:`Song ${i+1}`,author:'Test Author',familyId:i===0?1:null,language:'ENGLISH',songType:'SLOW',lyrics:`[Verse 1]\nSong ${i+1} first section\n[Verse 2]\nSong ${i+1} second section\n[Chorus]\nSong ${i+1} chorus`}));
 const plans=[{id:1,name:'Sunday Worship Service With A Long Descriptive Name',songs,reusable:false,serviceDate:'2026-09-18'}];
 await context.route(`http://${new URL(process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5178').hostname}:8080/**`,async r=>{
  const u=new URL(r.request().url()),p=u.pathname;let data=[];
  if(p==='/projector/capabilities')return r.fulfill({status:404,json:{}});
  if(p==='/songs')data=songs;
  else if(p==='/song-families/1/versions')data={familyId:1,displayName:'Grace and Peace',versions:{ENGLISH:songs[0]}};
  else if(p==='/playlists')data=plans;
  else if(p==='/settings')data={churchName:'Humility & Mercy Gospel Assembly',churchAbbreviation:'HMGA',defaultLanguage:'ENGLISH',defaultBackground:'deep-blue',defaultServiceType:'Sunday'};
  else if(p==='/events')data=[{id:1,title:'Community Worship and Prayer Together',eventDate:'2099-09-17',startTime:'12:00',location:'Main sanctuary',birthdayEntries:[]}];
  else if(p==='/service-plans')data=[{id:1,serviceName:'Sunday Worship Service',serviceDate:'2026-09-17',status:'COMPLETED',songs:songs.slice(0,3)}];
  else if(p==='/system/network')data={application:'church-song-system',ready:true,state:'advertising',friendlyUrl:'http://churchsongs.local:8080',message:'Bookmark this address on the Mac.',addresses:[{interfaceName:'lan',adapter:'Church Ethernet',url:'http://192.168.5.10:8080'}]};
  else if(p.includes('melody-reference'))return r.fulfill({status:204});
  else if(p==='/bible/translations')data=[{code:'LSG1910',name:'French'},{code:'KJV',name:'English'}];
  else if(p==='/bible/books')data=[{key:'JOHN',name:'John',chapterCount:2}];
  else if(p.includes('/metadata'))data={bookKey:'JOHN',chapter:1,availableVerseNumbers:[1,2,3]};
  else if(p==='/bible/passage')data={bookKey:'JOHN',bookName:'John',chapter:1,startVerse:1,endVerse:3,translationCode:u.searchParams.get('translation'),verses:[1,2,3].map(verseNumber=>({verseNumber,text:'Bible verse '+verseNumber}))};
  return r.fulfill({json:data});
 });
 const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
 const url=process.env.EVENTS_TEST_URL || 'http://127.0.0.1:5188';
 await page.goto(url);await page.locator('.playlist-select').selectOption('1');
 const projector=await context.newPage();await projector.goto(url+'/?projector=1');
 await page.locator('.section-pill').getByText('Verse 1',{exact:true}).click();
 await page.locator('.right-console').getByRole('button',{name:'Send to Projector',exact:true}).first().click();
 await projector.getByText('Song 1 first section',{exact:true}).waitFor();
 // Preserve independently rendered projector output at all representative sizes.
 for(const [width,height] of sizes){
  await projector.setViewportSize({width,height});await projector.waitForTimeout(120);
  const shot=await projector.screenshot({path:path.join(out,`projector-${width}x${height}.png`)});
  if(process.env.RESPONSIVE_BASELINE) assert(shot.equals(fs.readFileSync(path.join(process.env.RESPONSIVE_BASELINE,`projector-${width}x${height}.png`))),`projector pixels changed at ${width}x${height}`);
 }
 await projector.setViewportSize({width:1280,height:720});
 async function fit(label){
  const bad=await page.evaluate(()=>{
   const root=document.querySelector('.main-area'),vw=innerWidth;
   const list=[];
   if(document.documentElement.scrollWidth>vw+1)list.push('page width '+document.documentElement.scrollWidth);
   for(const e of document.querySelectorAll('.app-shell :is(button,input,select,textarea,.console-card,.settings-grid,.modal,.side-nav,.operator-panel-nav,.app-scrollable)')){
    if(e.closest('.projector-screen'))continue;
    const s=getComputedStyle(e),r=e.getBoundingClientRect();
    if(!e.getClientRects().length||s.visibility==='hidden'||s.display==='none'||!r.width)continue;
    if(r.left < -1 || r.right>vw+1)list.push(e.className+' rect '+Math.round(r.left)+'..'+Math.round(r.right));
    if(e.matches('.app-scrollable,.modal')&&e.scrollWidth>e.clientWidth+2)list.push(e.className+' clipped '+e.scrollWidth+'/'+e.clientWidth);
   }
   if(root.scrollWidth>root.clientWidth+2)list.push('main overflow '+root.scrollWidth+'/'+root.clientWidth);
   return [...new Set(list)].slice(0,20);
  });
  if(process.env.RESPONSIVE_AUDIT){console.log(label,JSON.stringify(bad));return;}
  if(bad.length){
   console.log('OVERFLOW',label,await page.evaluate(()=>[...document.querySelectorAll('.main-area *')].filter(e=>!e.closest('.projector-screen')&&e.clientWidth&&e.scrollWidth>e.clientWidth+3).map(e=>({cls:e.className,tag:e.tagName,width:e.clientWidth,scroll:e.scrollWidth})).slice(0,30)));
   await page.screenshot({path:path.join(out,'failure.png')});
  }
  assert.deepEqual(bad,[],label);
 }
 async function nav(name){await page.locator('.side-nav').getByRole('button',{name}).click();}
 for(const [width,height] of sizes){
  await page.setViewportSize({width,height});
  if(process.env.RESPONSIVE_AUDIT){await fit(`${width}x${height}`);continue;}
  assert(await page.locator('.side-nav').isVisible(),`navigation at ${width}`);
  await nav(/Worship Console/);await page.locator('.playlist-select').selectOption('1');await fit(`console ${width}x${height}`);
  const complete = page.locator('.service-plan-console-actions').getByRole('button', { name: 'Complete Service', exact: true });
  await complete.scrollIntoViewIfNeeded();
  await complete.click({trial:true});
  const bounds = await complete.evaluate(button => {
    const card = button.closest('.service-card'), b = button.getBoundingClientRect(), c = card.getBoundingClientRect();
    const picker = card.querySelector('.service-card-playlist-picker').getBoundingClientRect();
    const list = card.querySelector('.service-song-list-shell').getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(button);
    const t = range.getBoundingClientRect(), style = getComputedStyle(card);
    return { left:b.left, right:b.right, top:b.top, bottom:b.bottom, width:b.width,
      innerLeft:c.left + parseFloat(style.paddingLeft) + 1, innerRight:c.right - parseFloat(style.paddingRight) - 1,
      cardBottom:c.bottom, pickerBottom:picker.bottom, listTop:list.top,
      textLeft:t.left, textRight:t.right, textTop:t.top, textBottom:t.bottom, textHeight:t.height,
      scroll:button.scrollWidth, client:button.clientWidth };
  });
  assert(bounds.left >= bounds.innerLeft - 1 && bounds.right <= bounds.innerRight + 1, 'Complete Service respects panel padding');
  assert(bounds.top >= bounds.pickerBottom && bounds.bottom <= bounds.listTop && bounds.bottom < bounds.cardBottom, 'Complete Service between picker and list');
  assert(bounds.textLeft >= bounds.left + 6 && bounds.textRight <= bounds.right - 6 && bounds.textTop >= bounds.top && bounds.textBottom <= bounds.bottom && bounds.textHeight < 24, 'Complete Service label fully visible on one line');
  assert(bounds.scroll <= bounds.client + 1, 'Complete Service text never clips');
  assert(Math.abs(bounds.right - bounds.innerRight) < 2, 'Complete Service right aligned');
  if (width <= 600) assert(Math.abs(bounds.left - bounds.innerLeft) < 2, 'Complete Service full width on phones');
  // 320px is additional coverage for Complete Service; retain the existing full-app matrix.
  if (width === 320) { console.log('PASS Complete Service bounds/label/usability 320x740'); continue; }
  const viewport=page.locator('.right-console .song-detail-body');
  await page.locator('.right-console .current-heading h3').click();
  await viewport.evaluate(e=>e.scrollTop=0);await page.keyboard.press('ArrowDown');await page.waitForTimeout(400);
  assert((await viewport.evaluate(e=>e.scrollTop))>0,`keyboard scrolling at ${width}`);
  for(const selector of ['.library-card .search-wrapper input','.service-card .add-song-button','.prepare-workspace-tab']){
   const el=page.locator(selector).first();await el.scrollIntoViewIfNeeded();await el.click({trial:true});
  }
  if(width<=850){await page.locator('.operator-panel-nav a').first().click();await page.locator('.operator-panel-nav a').last().click();}
  await page.locator('.prepare-workspace-tab').getByText('Bible',{exact:true}).click();
  await page.getByRole('button',{name:'Preview Passage',exact:true}).click();await page.locator('.bible-console-verse').first().waitFor();await fit(`bible ${width}x${height}`);
  await page.locator('.prepare-workspace-tab').getByText('Song',{exact:true}).click();
  for(const [name,label] of [[/Songs/,'songs'],[/Playlists/,'playlists'],[/Service History/,'history'],[/Upcoming Events/,'events'],[/Settings/,'settings'],[/Backup/,'backup']]){
   await nav(name);await fit(`${label} ${width}x${height}`);
   if(label==='songs'){
    await page.getByRole('button',{name:/New Song/}).first().click();await page.locator('.modal').waitFor();await fit(`song modal ${width}x${height}`);
    await page.locator('.modal input').first().fill('Responsive fixture');await page.locator('.modal').getByRole('button',{name:'Cancel',exact:true}).click();
    for(const action of ['Edit Song','Edit Sections','Add Translation']){
      await page.getByRole('button',{name:action,exact:true}).first().click();await page.locator('.modal').waitFor();await fit(`${action} modal ${width}x${height}`);
      await page.locator('.modal').getByRole('button',{name:'Cancel',exact:true}).click();
    }
   }
   if(label==='playlists'){
    await page.getByRole('button',{name:'Create New Playlist',exact:true}).click();await page.locator('.modal').waitFor();await fit(`playlist modal ${width}x${height}`);
    await page.locator('.modal').getByRole('button',{name:'Cancel',exact:true}).click();
   }
   if(label==='events'){
    await page.getByRole('button',{name:/Add Event/}).first().click();await page.locator('.modal').waitFor();await fit(`event modal ${width}x${height}`);
    await page.locator('.modal select').first().selectOption('BIRTHDAY_LIST');
    await page.getByRole('button',{name:'+ Add Birthday',exact:true}).click();await fit(`birthday modal ${width}x${height}`);
    await page.locator('.modal').getByRole('button',{name:'Cancel',exact:true}).click();
   }
  }
  await nav(/Worship Console/);
  await page.screenshot({path:path.join(out,`operator-${width}x${height}.png`)});
  console.log('PASS layout/navigation/inputs/modals/Bible',width+'x'+height);
 }
 if(!process.env.RESPONSIVE_AUDIT){
  // Actual phone pointer controls against a separate projector document.
  await page.setViewportSize({width:390,height:844});await nav(/Worship Console/);
  await page.locator('.playlist-select').selectOption('1');
  const prep=page.locator('.prepared-song-preview');
  await page.locator('.section-pill').getByText('Verse 1',{exact:true}).click();
  await prep.getByRole('button',{name:'Send to Projector',exact:true}).click();await projector.getByText('Song 1 first section',{exact:true}).waitFor();
  await prep.getByRole('button',{name:'Next →',exact:true}).click();await projector.getByText('Song 1 second section',{exact:true}).waitFor();
  await prep.getByRole('button',{name:'← Previous',exact:true}).click();await projector.getByText('Song 1 first section',{exact:true}).waitFor();
  await prep.getByRole('button',{name:'Clear Lyrics',exact:true}).click();await projector.locator('.screen-lyrics').waitFor({state:'hidden'});
  await prep.getByRole('button',{name:'Show Lyrics',exact:true}).click();await projector.getByText('Song 1 first section',{exact:true}).waitFor();
  await prep.getByRole('button',{name:'Black',exact:true}).click();await projector.locator('.projector-screen.black').waitFor();
  await prep.getByRole('button',{name:'Show Screen',exact:true}).click();await projector.getByText('Song 1 first section',{exact:true}).waitFor();
  await projector.reload();assert.equal((await projector.locator('.projector-screen').innerText()).trim(),'');
  await prep.getByRole('button',{name:'Send to Projector',exact:true}).click();await projector.getByText('Song 1 first section',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log('PASS phone pointer controls and fresh Send Live projector safety');
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
