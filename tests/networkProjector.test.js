import test from 'node:test'
import assert from 'node:assert/strict'
import { createNetworkProjector } from '../src/networkProjector.js'

async function fixture(role = 'PROJECTOR') {
  const sockets = [], states = [], errors = []
  class Socket {
    readyState = 1
    sent = []
    constructor(url) { this.url = url; sockets.push(this) }
    send(value) { this.sent.push(JSON.parse(value)) }
    close() {}
    receive(data) { this.onmessage({ data: JSON.stringify(data) }) }
  }
  const transport = createNetworkProjector({ role, origin: 'http://192.168.1.50:8080', Socket,
    fetcher: async () => ({ ok: true, json: async () => ({ protocol: 'church-projector-v1' }) }),
    onState: (...args) => states.push(args), onError: value => errors.push(value) })
  await new Promise(resolve => setImmediate(resolve))
  const socket = sockets[0]
  socket.onopen()
  const live = id => ({ projectionMode: 'LIVE', liveSend: { id }, projectionSong: { title: id } })
  const welcome = () => socket.receive({ type: 'WELCOME', epoch: 'server', revision: 10, state: live('old') })
  const update = (action, revision, id = 'old') => socket.receive({ type: 'STATE', epoch: 'server', revision, action, state: live(id) })
  return { transport, socket, states, errors, welcome, update }
}
test('fresh projector ignores handshake and navigation until a fresh Send Live', async () => {
  const f = await fixture()
  try {
    assert.equal(f.socket.url.href, 'ws://192.168.1.50:8080/projector/ws')
    f.welcome(); f.update('NEXT',11); assert.equal(f.states.length,0)
    f.update('SEND_LIVE',12,'fresh'); f.update('NEXT',13,'fresh')
    assert.equal(f.states.length,2)
    f.update('NEXT',13,'fresh'); assert.equal(f.states.length,2)
    f.update('NEXT',14,'missed-send'); assert.equal(f.states.length,2)
  } finally { f.transport.close() }
})
test('operator can observe current server snapshot without emitting commands', async () => {
  const f = await fixture('OPERATOR')
  try {
    f.welcome(); assert.equal(f.states.length,1)
    assert.deepEqual(f.socket.sent.map(m=>m.type), ['HELLO'])
    f.transport.command('NEXT')
    assert.equal(f.socket.sent[1].liveId,'old')
    assert.equal(f.socket.sent[1].sequence,1)
  } finally { f.transport.close() }
})
test('disconnected commands are rejected and are not queued or replayed', async () => {
  const f = await fixture('OPERATOR')
  try {
    f.transport.command('SEND_LIVE',{}); assert.equal(f.errors.length,1)
    f.welcome(); assert.equal(f.socket.sent.length,1)
    f.socket.readyState=3; f.transport.command('BLACK_SCREEN')
    assert.equal(f.socket.sent.length,1)
  } finally { f.transport.close() }
})
test('appearance and black controls never admit cached lyrics on a fresh projector', async () => {
  const f = await fixture()
  try {
    f.welcome(); f.update('BLACK_SCREEN',11); f.update('SHOW_LYRICS',12)
    assert(f.states.every(([,meta])=>meta.appearanceOnly))
  } finally { f.transport.close() }
})
test('legacy servers retain local transport', async () => {
  const transport = createNetworkProjector({ role: 'OPERATOR', fetcher: async()=>({ok:true,json:async()=>[]}) })
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(transport.mode,'local'); assert.equal(transport.command('NEXT'),false)
  transport.close()
})

test('Notes capability distinguishes an older live server from an updated validator', async () => {
  for (const types of [undefined, ['SONG','BIBLE','EVENT'], ['SONG','BIBLE','EVENT','NOTE']]) {
    const transport=createNetworkProjector({role:'OPERATOR',origin:'http://localhost:8080',Socket:class {close() {}},
      fetcher:async()=>({ok:true,json:async()=>({protocol:'church-projector-v1',contentTypes:types})})})
    try {
      await new Promise(resolve=>setImmediate(resolve))
      assert.equal(transport.supportsContent('NOTE'),Boolean(types?.includes('NOTE')))
    } finally {transport.close()}
  }
})

test('a suspended timer sends a fresh probe instead of falsely closing a healthy socket', async t => {
 let now=1000, tick
 t.mock.method(Date,'now',()=>now)
 t.mock.method(globalThis,'setInterval',callback=>{tick=callback;return 123})
 t.mock.method(globalThis,'clearInterval',()=>{})
 const f=await fixture('OPERATOR'), closes=[]
 f.socket.close=(...args)=>closes.push(args)
 try {
  f.welcome();now+=60000;tick()
  assert.deepEqual(closes,[],'old code closed here because last PONG was over 15 seconds ago')
  assert.equal(f.socket.sent.at(-1).type,'PING')
  f.socket.receive({type:'PONG'});now+=5000;tick()
  for(let i=0;i<3;i++){now+=5000;tick()}
  assert.deepEqual(closes,[[4000,'Heartbeat response timeout']],'a real unanswered probe still closes')
 } finally { f.transport.close() }
})
