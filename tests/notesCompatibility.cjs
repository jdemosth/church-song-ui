const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch();try{
 const context=await browser.newContext(),ui=process.env.EVENTS_TEST_URL||'http://127.0.0.1:5188',commands=[];
 await context.route(`http://${new URL(ui).hostname}:8080/**`,r=>{
  const p=new URL(r.request().url()).pathname;
  return r.fulfill({json:p==='/projector/capabilities'?{protocol:'church-projector-v1'}:p==='/settings'?{churchName:'Test'}:[]});
 });
 await context.routeWebSocket('**/projector/ws',socket=>socket.onMessage(raw=>{
  const msg=JSON.parse(raw);
  if(msg.type==='COMMAND')commands.push(msg);
  if(msg.type==='HELLO')socket.send(JSON.stringify({type:'WELCOME',connection:'test',epoch:'test',revision:0,state:{projectionMode:'CLEAR'}}));
  if(msg.type==='PING')socket.send(JSON.stringify({type:'PONG'}));
 }));
 const page=await context.newPage();await page.goto(ui);await page.getByRole('button',{name:'Notes',exact:true}).click();
 await page.getByLabel('Note',{exact:true}).fill('This needs a Notes-capable backend');
 await page.getByRole('button',{name:'Preview Note',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Review Note',exact:true});
 await dialog.getByRole('button',{name:'Send Note Live',exact:true}).click();
 await dialog.getByText(/Restart the backend with the updated Notes build/).waitFor();
 assert.deepEqual(commands,[],'incompatible backend must not receive a disguised or invalid note command');
 await dialog.getByRole('button',{name:'Return to Editing',exact:true}).click();
 assert.equal(await page.getByLabel('Note',{exact:true}).inputValue(),'This needs a Notes-capable backend');
 console.log('PASS old backend diagnosed clearly, no invalid/substitute command, draft retained');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
