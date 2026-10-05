const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch();try{
 const context=await browser.newContext(),ui=process.env.EVENTS_TEST_URL||'http://127.0.0.1:5188';
 const saved=[{id:1,title:'Hidden legacy title',topic:'King Saul Died a Saved Man',noteDate:'1991-03-20',content:'Test note content.\n\n1. A numbered line\n2. Another line'},
 {id:2,title:'Hidden untitled legacy',topic:null,noteDate:'1991-03-20',content:'Test note without subject.'}];
 const writes=[];
 await context.route(`http://${new URL(ui).hostname}:8080/**`,async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  if(request.method()!=='GET')writes.push(request.method()+' '+path);
  if(path==='/projector/capabilities')return route.fulfill({status:404,json:{}});
  if(path==='/notes/count')return route.fulfill({json:saved.length});
  if(path==='/notes')return route.fulfill({json:saved});
  if(path.startsWith('/notes/'))return route.fulfill({json:saved.find(n=>n.id===Number(path.split('/')[2]))});
  return route.fulfill({json:[]});
 });
 const page=await context.newPage(),projector=await context.newPage();await page.goto(ui);await projector.goto(ui+'/?projector=1');
 await page.getByRole('button',{name:'Notes',exact:true}).click();
 await page.evaluate(()=>{window.printCalls=0;window.print=()=>{window.printCalls++}});
 const body=page.getByLabel('Note',{exact:true}),subject=page.getByLabel('Subject',{exact:true}),date=page.getByLabel('Date',{exact:true});
 await body.fill('Independent live note');await page.getByRole('button',{name:'Preview Note',exact:true}).click();
 await page.getByRole('dialog',{name:'Review Note'}).getByRole('button',{name:'Send Note Live',exact:true}).click();await projector.getByText('Independent live note',{exact:true}).waitFor();
 const live=await projector.locator('.projector-screen').innerText(),writesBefore=writes.length;
 async function inspectPrint(note,expectedCalls,pdf=false){
  await page.waitForFunction(n=>window.printCalls===n,expectedCalls);
  const document=page.locator('.note-print-document');
  assert.equal(await document.locator('.note-print-body').textContent(),note.content);
  assert.equal(await document.locator('.note-heading-subject').count(),note.topic?1:0);
  if(note.topic)assert.equal(await document.locator('.note-heading-subject').textContent(),'Subject: '+note.topic);
  assert.equal(await document.locator('.note-heading-date').textContent(),'Date: March 20, 1991');
  assert.equal(await document.locator('button, input, textarea, table').count(),0);
  await page.emulateMedia({media:'print'});
  assert(await document.isVisible());assert.equal(await page.locator('.app-shell').isVisible(),false);
  const style=await document.evaluate(e=>{const css=getComputedStyle(e),h=getComputedStyle(e.querySelector('.note-heading')),b=getComputedStyle(e.querySelector('.note-print-body'));return {color:css.color,bg:css.backgroundColor,top:h.borderTopWidth,bottom:h.borderBottomWidth,wrap:b.whiteSpace,height:css.height,overflow:css.overflow}});
  assert.equal(style.color,'rgb(0, 0, 0)');assert.equal(style.bg,'rgb(255, 255, 255)');assert.equal(style.wrap,'pre-wrap');assert(parseFloat(style.top)>0&&parseFloat(style.bottom)>0);assert.equal(style.overflow,'visible');
  if(pdf){const bytes=await page.pdf({format:'A4'});assert(bytes.length>1000,'browser produces printable PDF');}
  await page.emulateMedia({media:null});
  assert.equal(await projector.locator('.projector-screen').innerText(),live);
  assert.equal(writes.length,writesBefore,'printing never writes records or sends API mutations');
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await document.waitFor({state:'detached'});
 }
 for(const [i,note] of saved.entries()){
  await subject.fill(note.topic||'');await date.fill(note.noteDate);await body.fill(note.content);
  await page.locator('.notes-panel > .notes-actions').getByRole('button',{name:'Print',exact:true}).click();
  await inspectPrint(note,i+1);
  assert.equal(await body.inputValue(),note.content);
 }
 const long={topic:'Long teaching',noteDate:'1991-03-20',content:('Paragraph with <literal markup> & readable text.\n\n').repeat(300)};
 await subject.fill(long.topic);await body.fill(long.content);await page.locator('.notes-panel > .notes-actions').getByRole('button',{name:'Print',exact:true}).click();await inspectPrint(long,3,true);
 const draft=await body.inputValue();
 await page.getByRole('button',{name:'Saved Notes',exact:true}).click();
 await page.getByLabel('2 saved notes',{exact:true}).waitFor();
 const rows=page.locator('.saved-note-row');await rows.first().waitFor();
 for(let i=0;i<saved.length;i++){
  await rows.nth(i).getByRole('button',{name:'Print',exact:true}).click();await inspectPrint(saved[i],4+i);
  assert.equal(await body.inputValue(),draft);assert.equal(await subject.inputValue(),long.topic);
  assert.equal(await page.getByRole('button',{name:'Saved Notes',exact:true}).getAttribute('aria-expanded'),'true');
 }
 console.log('PASS editor/saved-note native Print, Subject/date-only headers, note-only paper styles, multiline/long PDF, draft/live/database isolation and print cleanup');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
