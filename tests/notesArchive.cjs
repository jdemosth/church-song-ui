const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch();try {
 const context=await browser.newContext(),ui=process.env.EVENTS_TEST_URL||'http://127.0.0.1:5188';let notes=[],nextId=1;
 await context.route(`http://${new URL(ui).hostname}:8080/**`,async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  if(path==='/projector/capabilities')return route.fulfill({status:404,json:{}});
  if(path==='/notes/count')return route.fulfill({json:notes.length});
  if(!path.startsWith('/notes'))return route.fulfill({json:[]});
  const id=Number(path.split('/')[2]),method=request.method();let data;
  if(method==='GET')data=id?notes.find(n=>n.id===id):notes.filter(n=>JSON.stringify(n).toLowerCase().includes((url.searchParams.get('q')||'').toLowerCase())).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||b.id-a.id);
  if(method==='POST'){data={...request.postDataJSON(),id:nextId++,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};notes.push(data)}
  if(method==='PUT'){data={...notes.find(n=>n.id===id),...request.postDataJSON(),updatedAt:new Date().toISOString()};notes=notes.map(n=>n.id===id?data:n)}
  if(method==='DELETE'){notes=notes.filter(n=>n.id!==id);return route.fulfill({status:204})}
  return route.fulfill({json:data});
 });
 const page=await context.newPage(),projector=await context.newPage();await page.goto(ui);await projector.goto(ui+'/?projector=1');
 await require('./notesArchiveScenarios.cjs')(page,projector);
 const assert=require('node:assert/strict');
 const live=await projector.locator('.note-text').textContent();
 const legacy=notes.find(n=>n.title==='Long teaching archive');legacy.topic=null;legacy.servicePlanId=77;legacy.speakerOrAuthor='Preserved speaker';legacy.scriptureReference='John 3';legacy.tags='legacy';
 await page.getByRole('region',{name:'Saved Notes library'}).getByRole('button',{name:'Search',exact:true}).click();
 await page.getByRole('region',{name:'Saved Notes library'}).locator('.saved-note-row').filter({has:page.getByRole('heading',{name:'—',exact:true})}).getByRole('button',{name:'Open/Edit',exact:true}).click();
 await page.waitForFunction(()=>document.activeElement?.id==='sermon-note-text');
 await page.getByLabel('Note',{exact:true}).fill('Updated legacy body');await page.getByRole('button',{name:'Save Note',exact:true}).click();await page.getByText('Note saved in the application database.',{exact:true}).waitFor();
 const preserved=notes.find(n=>n.id===legacy.id);assert.equal(preserved.title,'Long teaching archive');assert(!preserved.topic);assert.equal(preserved.servicePlanId,77);assert.equal(preserved.speakerOrAuthor,'Preserved speaker');assert.equal(preserved.scriptureReference,'John 3');assert.equal(preserved.tags,'legacy');assert.equal(preserved.content,'Updated legacy body');
 assert.equal(notes.length,1,'existing ID must be updated, not duplicated');
 // Subject is optional for creation; hidden compatibility title is supplied without exposing it.
 await page.getByRole('button',{name:'New Note',exact:true}).click();
 await page.getByLabel('Date',{exact:true}).fill('1991-03-20');
 await page.getByLabel('Note',{exact:true}).fill('An untitled teaching');
 await page.getByRole('button',{name:'Save Note',exact:true}).click();await page.getByText('Note saved in the application database.',{exact:true}).waitFor();
 const untitled=notes.find(n=>n.content==='An untitled teaching');assert(untitled);assert(!untitled.topic);assert.equal(untitled.title,'Untitled note');
 // Large library stays bounded; compact rows retain all actions and wrap long text.
 await page.getByRole('button',{name:'Saved Notes',exact:true}).click();
 const library=page.getByRole('region',{name:'Saved Notes library'});
 notes.push(...Array.from({length:40},(_,i)=>({id:100+i,title:i===39?'Long title '.repeat(15):`Teaching ${i}`,topic:i===39?'Long subject '.repeat(20):`Teaching ${i}`,noteDate:'2026-09-29',content:'Saved body',updatedAt:`2027-01-${String(i%28+1).padStart(2,'0')}T12:00:00Z`}))); 
 await library.getByRole('button',{name:'Search',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.saved-note-row').length===42);
 assert.deepEqual(await library.locator('thead th').allTextContents(),['Subject','Date','Actions']);
 assert.equal(await library.locator('.saved-note-row').first().locator('h4').textContent(),'Teaching 27');
 for(const width of [1920,1440,1024,768,430,390,375,320]) {
  await page.setViewportSize({width,height:900});
  const layout=await library.evaluate(element=>{
   const list=element.querySelector('.saved-notes-list'),rows=[...element.querySelectorAll('.saved-note-row')];
   return {overflow:document.documentElement.scrollWidth>innerWidth,scrollable:list.scrollHeight>list.clientHeight,height:list.getBoundingClientRect().height,
    actions:rows.every(row=>[...row.querySelectorAll('button')].every(button=>{const b=button.getBoundingClientRect(),r=list.getBoundingClientRect();return b.width>=40&&b.height>=32&&b.left>=r.left&&b.right<=r.right})),
    compact:rows.filter(row=>row.textContent.includes('Teaching ')).every(row=>row.getBoundingClientRect().height<130)};
  });
  assert(!layout.overflow,`page overflow at ${width}`);assert(layout.scrollable);assert(layout.height<=440);assert(layout.actions,`actions fit at ${width}`);assert(layout.compact);
 }
 // Exercise the actual desktop table at a wide panel size independently of console columns.
 await page.setViewportSize({width:1440,height:900});await library.evaluate(element=>element.style.width='650px');
 assert.equal(await library.locator('.saved-note-row').first().evaluate(row=>getComputedStyle(row).display),'table-row');
 await library.evaluate(element=>element.style.removeProperty('width'));
 assert.equal(await projector.locator('.note-text').textContent(),live);
 console.log('PASS compact library columns, newest ordering, long text, bounded scrolling and actions at 320–1920px');
 await page.route('**/notes/**',route=>route.fulfill({status:503,json:{message:'Archive temporarily unavailable. Draft retained.'}}));
 await page.getByLabel('Note',{exact:true}).fill('Unsaved recovery content');
 await page.getByRole('button',{name:'Save Note',exact:true}).click();
 await page.getByText('Archive temporarily unavailable. Draft retained.',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Note',{exact:true}).inputValue(),'Unsaved recovery content');
 assert.equal(await projector.locator('.note-text').textContent(),live);
 await page.reload();await page.getByRole('button',{name:'Notes',exact:true}).click();
 assert.equal(await page.getByLabel('Note',{exact:true}).inputValue(),'Unsaved recovery content');
 console.log('PASS failed archive save retains draft through refresh and leaves live Note unchanged');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
