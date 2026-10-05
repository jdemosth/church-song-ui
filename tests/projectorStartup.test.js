import test from 'node:test'
import assert from 'node:assert/strict'
import { createProjectorStartupGate, projectorAppearanceState } from '../src/projectorStartup.js'

test('startup ignores stored and startup-sync content while keeping background', () => {
  const gate = createProjectorStartupGate(100, 'old')
  for (const liveSend of [undefined, {id:'old',issuedAt:100}, {id:'earlier',issuedAt:99}]) {
    const result = gate({projectionMode:'LIVE', projectedEvents:[{id:1}], backgroundVariant:'deep-blue',liveSend})
    assert.equal(result.projectionMode,'CLEAR')
    assert.deepEqual(result.projectedEvents,[])
    assert.equal(result.backgroundVariant,'deep-blue')
  }
})
test('explicit sends unlock normal paging; reopening requires another send', () => {
  const gate=createProjectorStartupGate(100,'old')
  const state={projectionMode:'LIVE',liveSend:{id:'new',issuedAt:101},projectedEventPageIndex:0}
  assert.equal(gate(state),state)
  assert.equal(gate({...state,projectedEventPageIndex:1}).projectedEventPageIndex,1)
  assert.equal(createProjectorStartupGate(102,'new')(state).projectionMode,'CLEAR')
  assert.equal(gate({...state,projectionMode:'BLACK'}).projectionMode,'BLACK')
})
test('Black works before first send without revealing stale content afterward', () => {
  const gate=createProjectorStartupGate(100)
  assert.equal(gate({projectionMode:'BLACK'}).projectionMode,'BLACK')
  assert.equal(gate({projectionMode:'LIVE'}).projectionMode,'CLEAR')
})

test('reconnecting appearance updates exclude cached content, send identity and mode', () => {
  assert.deepEqual(projectorAppearanceState({
    backgroundVariant: 'deep-blue', projectionSettings: {fontSize: 40},
    projectionMode: 'LIVE', liveSend: {id: 'old'}, projectedEvents: [{id: 1}],
    projectionSong: {id: 2}, projectedBiblePassage: {reference: 'John 1'},
    projectedEventPageIndex: 2,
  }), {backgroundVariant: 'deep-blue', projectionSettings: {fontSize: 40}})
})
