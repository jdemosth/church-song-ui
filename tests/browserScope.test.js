import test from 'node:test'
import { setImmediate } from 'node:timers'
import assert from 'node:assert/strict'
import { configureBrowserScope, scopedKey, scopedStorage, storageEventKey } from '../src/browserScope.js'
import { createNetworkProjector } from '../src/networkProjector.js'

test('Church and identity namespaces preserve standalone drafts and separate accounts', () => {
  const values = new Map([['draft', 'Existing standalone note']])
  globalThis.window = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) } }
  configureBrowserScope({ mode: 'hosted', userId: 10, churchId: 1 })
  assert.equal(scopedStorage.getItem('draft'), null)
  scopedStorage.setItem('draft', 'First church')
  const first = scopedKey('draft')
  configureBrowserScope({ mode: 'hosted', userId: 10, churchId: 2 })
  assert.equal(scopedStorage.getItem('draft'), null)
  scopedStorage.setItem('draft', 'Second church')
  assert.equal(storageEventKey({ key: first }), null)
  configureBrowserScope({ mode: 'hosted', userId: 11, churchId: 1 })
  assert.equal(scopedStorage.getItem('draft'), null)
  configureBrowserScope({ mode: 'hosted', userId: 10, churchId: 1 })
  assert.equal(scopedStorage.getItem('draft'), 'First church')
  configureBrowserScope({ mode: 'standalone' })
  assert.equal(scopedStorage.getItem('draft'), 'Existing standalone note')
  delete globalThis.window
})

test('Hosted projector never discovers or connects to the global hub or falls back locally', () => {
  configureBrowserScope({ mode: 'hosted', userId: 10, churchId: 1 })
  let fetches = 0, sockets = 0
  const projector = createNetworkProjector({ role: 'OPERATOR', fetcher: () => { fetches++ }, Socket: class { constructor() { sockets++ } } })
  assert.equal(projector.mode, 'disabled')
  assert.equal(projector.supportsContent('SONG'), false)
  assert.equal(projector.command('SEND_LIVE', {}), true)
  assert.equal(fetches, 0); assert.equal(sockets, 0)
  projector.close()
  configureBrowserScope({ mode: 'standalone' })
})

test('Hosted projector session namespaces isolate drafts, channels and popup keys', () => {
  const values=new Map();const channels=[];
  globalThis.window={localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},BroadcastChannel:class{constructor(name){channels.push(name)}}};
  configureBrowserScope({mode:'hosted',userId:10,churchId:1,projectorSession:'first'});
  scopedStorage.setItem('draft','First session');const first=scopedKey('church-song-projector-window');
  configureBrowserScope({mode:'hosted',userId:10,churchId:1,projectorSession:'second'});
  assert.equal(scopedStorage.getItem('draft'),null);assert.notEqual(scopedKey('church-song-projector-window'),first);assert.equal(storageEventKey({key:first}),null);
  configureBrowserScope({mode:'hosted',userId:10,churchId:2,projectorSession:'first'});assert.equal(scopedStorage.getItem('draft'),null);
  configureBrowserScope({mode:'hosted',userId:10,churchId:1,projectorSession:'first'});assert.equal(scopedStorage.getItem('draft'),'First session');
  configureBrowserScope({mode:'standalone'});delete globalThis.window;
})

test('Hosted transport retries transient ticket failure without falling back or replaying a command', async () => {
  configureBrowserScope({mode:'hosted',userId:10,churchId:1,projectorSession:'retry'});
  const realSetTimeout=globalThis.setTimeout;let retry,attempts=0;const sockets=[];
  globalThis.setTimeout=(fn,ms)=>{if(ms===1500){retry=fn;return 0}return realSetTimeout(fn,ms)};
  const transport=createNetworkProjector({role:'PROJECTOR',origin:'http://localhost:8080',fetcher:async path=>{
    if(path.endsWith('capabilities'))return {ok:true,json:async()=>({protocol:'church-projector-v1',contentTypes:['NOTE']})};
    attempts++;if(attempts===1)throw new TypeError('Network interrupted');
    return {ok:true,json:async()=>({ticket:'one-use-ticket',path:'/projector/sessions/retry/ws'})};
  },Socket:class{constructor(url,protocols){this.url=url;this.protocols=protocols;this.readyState=1;sockets.push(this)}close(){}send(){}}});
  try{
    await new Promise(r=>setImmediate(r));assert.equal(transport.mode,'network');assert.equal(sockets.length,0);assert.equal(typeof retry,'function');
    assert.equal(transport.command('SEND_LIVE',{projectedNote:'Never queue'}),true);
    await retry();assert.equal(sockets.length,1);assert.deepEqual(sockets[0].protocols,['boc-ticket.one-use-ticket']);assert.equal(new URL(sockets[0].url).pathname,'/projector/sessions/retry/ws');
  } finally{transport.close();globalThis.setTimeout=realSetTimeout;configureBrowserScope({mode:'standalone'})}
})
