const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const origin=process.env.HOSTED_TEST_URL;
 assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin),'Disposable loopback API required');
 const browser=await chromium.launch();
 try {
  async function api(context,path,body,method='POST') {
   const csrf=await (await context.request.get(origin+'/auth/csrf')).json();
   const r=await context.request.fetch(origin+path,{method,headers:{[csrf.headerName]:csrf.token},...(body===undefined?{}:{data:body})});
   assert(r.ok(),`${method} ${path}: ${r.status()} ${await r.text()}`);
   return (await r.text()) ? r.json() : null;
  }
  async function login(name) {
   const c=await browser.newContext();
   const csrf=await (await c.request.get(origin+'/auth/csrf')).json();
   const r=await c.request.post(origin+'/auth/development-login',{headers:{[csrf.headerName]:csrf.token},form:{username:name+'@test.invalid',password:process.env.HOSTED_TEST_PASSWORD}});assert.equal(r.status(),204);
   await c.request.get(origin+'/auth/session');
   await c.addInitScript(()=>{ const Native=window.WebSocket;window.testSockets=[];window.WebSocket=class extends Native{constructor(...args){super(...args);window.testSockets.push(this)}} });
   return c;
  }
  const a=await login('admin1'), b=await login('admin2'), mod=await login('platform');
  const sa=await api(a,'/projector/sessions',{name:'First church first session'}), sa2=await api(a,'/projector/sessions',{name:'First church second session'}), sb=await api(b,'/projector/sessions',{name:'Second church'});
  async function page(context,id,projector=false) {
   const p=await context.newPage();p.on('pageerror',e=>console.error(e.message));await p.goto(`${origin}/?session=${id}${projector?'&projector=1':''}`);
   await p.waitForFunction(()=>window.testSockets.some(s=>s.readyState===1));
   if(projector) assert.equal(await p.getByRole('region',{name:'Account',exact:true}).count(),0);
   if(!projector){await p.locator('nav.side-nav').getByRole('button',{name:/Worship Console/}).click();await p.getByRole('button',{name:'Notes',exact:true}).click();}
   return p;
  }
  const oa=await page(a,sa.id), pa=await page(a,sa.id,true), oa2=await page(a,sa2.id), pa2=await page(a,sa2.id,true), ob=await page(b,sb.id), pb=await page(b,sb.id,true);
  for(const p of [pa,pa2,pb])assert.equal(await p.locator('.projector-screen').innerText(),'');
  async function send(p,text){await p.getByLabel('Note',{exact:true}).fill(text);await p.getByRole('button',{name:'Preview Note',exact:true}).click();await p.getByRole('button',{name:'Send Note Live',exact:true}).last().click();}
  async function shown(p,text){await p.waitForFunction(t=>document.querySelector('.note-text')?.textContent===t,text);}
  await send(oa,'First church first display');await shown(pa,'First church first display');assert.equal(await pa2.locator('.projector-screen').innerText(),'');assert.equal(await pb.locator('.projector-screen').innerText(),'');
  await send(oa2,'First church second display');await shown(pa2,'First church second display');
  await send(ob,'Second church display');await shown(pb,'Second church display');await shown(pa,'First church first display');
  assert.equal(await oa2.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('note')).every(k=>k.includes('p')||!k.startsWith('boc:'))),true);
  await oa.reload();await shown(pa,'First church first display');
  await pa.evaluate(()=>window.testSockets.at(-1).close());await pa.waitForFunction(()=>window.testSockets.length>1&&window.testSockets.at(-1).readyState===1);await shown(pa,'First church first display');
  await pa.reload();await pa.waitForFunction(()=>window.testSockets.at(-1)?.readyState===1);assert.equal(await pa.locator('.projector-screen').innerText(),'');
  await oa.getByRole('button',{name:'Notes',exact:true}).click();await send(oa,'Fresh explicit note');await shown(pa,'Fresh explicit note');
  await api(a,'/projector/sessions/'+sa.id,undefined,'DELETE');await pa.waitForFunction(()=>window.testSockets.at(-1).readyState===3);await pa.waitForFunction(()=>document.querySelector('.projector-screen')?.innerText==='');await shown(pa2,'First church second display');await shown(pb,'Second church display');
  // Real submission and moderation UI: the platform reviewer has no church membership.
  const song=await api(a,'/songs',{title:'Pilot exact reviewed song',lyrics:'Original reviewed lyrics',songType:'SLOW',language:'ENGLISH'});
  await oa2.getByRole('button',{name:'Shared songs',exact:true}).click();const library=oa2.getByRole('region',{name:'Shared song library'});
  await library.getByLabel('Song',{exact:true}).selectOption(String(song.id));await library.getByRole('button',{name:'Submit exact contents'}).click();await library.getByText(/PENDING/).waitFor();
  const reviewer=await mod.newPage();await reviewer.goto(origin);const approval=reviewer.waitForResponse(r=>r.url().includes('/moderation/songs/')&&r.url().endsWith('/review')&&r.request().method()==='POST');await reviewer.locator('article').filter({has:reviewer.getByRole('heading',{name:new RegExp(song.title)})}).getByRole('button',{name:/Approve revision/}).click();assert.equal((await approval).status(),200);
  await ob.getByRole('button',{name:'Shared songs',exact:true}).click();const shared=ob.getByRole('region',{name:'Shared song library'});await shared.getByRole('button',{name:/Use revision/}).first().click();await shared.getByText(/Saved\./).waitFor();
  const songs=await (await b.request.get(origin+'/songs')).json();assert(songs.some(s=>s.title===song.title&&s.lyrics===song.lyrics&&s.id!==song.id));
  await api(a,'/auth/logout');await pa2.waitForFunction(()=>window.testSockets.at(-1).readyState===3);await shown(pb,'Second church display');
  console.log('PASS real hosted browser: three isolated sessions, blank startup, refresh/reconnect, fresh Send Live, session closure/logout, owner submission, platform approval, other-church exact revision import');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
