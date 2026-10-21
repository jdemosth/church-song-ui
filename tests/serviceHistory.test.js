import test from 'node:test'
import assert from 'node:assert/strict'
import { mapWorkingServicePlans, canReuseHistory, historyPreservationMessage } from '../src/serviceHistory.js'

test('library edits preserve completed service payload and songs by identity', () => {
  const history = Object.freeze({ id: 1, status: 'COMPLETED', snapshotPayload: 'original bytes', songs: Object.freeze([{ id: 7, lyrics: 'Original' }]) })
  const active = { id: 2, status: 'ACTIVE', songs: [{ id: 7, lyrics: 'Original' }] }
  const result = mapWorkingServicePlans([history, active], plan => ({ ...plan, songs: [{ id: 7, lyrics: 'Edited' }] }))
  assert.equal(result[0], history)
  assert.equal(result[1].songs[0].lyrics, 'Edited')
})

test('recovery provenance is explicit and missing or opaque history cannot be reused', () => {
  assert.match(historyPreservationMessage({ snapshotProvenance: 'RECOVERED_AT_MIGRATION' }), /Original performance-time lyrics may differ/)
  assert.equal(canReuseHistory({ snapshotReadable: false }), false)
  assert.equal(canReuseHistory({ songs: [{ missingHistoryContent: true }] }), false)
  assert.equal(canReuseHistory({ snapshotReadable: true, songs: [] }), true)
})
