import test from 'node:test'
import assert from 'node:assert/strict'
import { selectedEvents, liveVerseIndex } from '../src/operatorFeatures.js'
import { createProjectorStartupGate } from '../src/projectorStartup.js'
test('event selection retains canonical order without modifying saved events', () => {
  const events = Array.from({length:10}, (_,i) => ({id:i+1}))
  for (const ids of [[1], [1,3,6,7], [1,3,6,7,10], []]) {
    assert.deepEqual(selectedEvents(events,ids).map(event=>event.id),ids)
  }
  assert.equal(selectedEvents(events,null),events); assert.equal(events.length,10)
})
test('live verse numbers map to passage positions, including gaps and both language texts', () => {
  const passage={verses:[1,5,16,20].map(verseNumber=>({verseNumber,primaryText:'FR',secondaryText:'EN'}))}
  for (const [value,index] of [['1',0],['5',1],['16',2],['20',3]]) assert.equal(liveVerseIndex(passage,value),index)
  for (const value of ['','0','-1','2','21','1.5','1e1','word','99999999999999999999']) assert.equal(liveVerseIndex(passage,value),-1)
  assert.equal(liveVerseIndex(null,'16'),-1)
})
test('restored sermon notes stay blank until a fresh explicit send', () => {
  const gate=createProjectorStartupGate(10,'old')
  const state={projectionContentType:'NOTE',projectedNote:'Restored note',projectionMode:'LIVE',liveSend:{id:'old',issuedAt:1}}
  assert.equal(gate(state).projectedNote,'')
  assert.equal(gate({...state,liveSend:{id:'fresh',issuedAt:11}}).projectedNote,'Restored note')
})

test('note limits allow multiline statements and reject unbounded line counts', async () => {
  const { noteValidation } = await import('../src/operatorFeatures.js')
  assert.equal(noteValidation('Keep faith.\nKeep going.'),'')
  assert.equal(noteValidation('x'.repeat(2000)),'')
  for (const value of ['', '   ', 'x'.repeat(2001), 'line\n'.repeat(41)]) assert(noteValidation(value))
})
