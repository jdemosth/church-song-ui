import test from 'node:test'
import assert from 'node:assert/strict'
import { nextNoteNavigation, noteLineTarget, noteViewportTarget } from '../src/noteScroll.js'
import { keyboardShortcut } from '../src/projectorKeyboard.js'
test('Note line/page navigation uses measured boundaries and overlap, including wheel offsets', () => {
 const lines = Array.from({length:30},(_,i)=>i*31.5)
 assert.equal(noteLineTarget(lines,0,315,630,1,'line'),31.5)
 assert.equal(noteLineTarget(lines,20,315,630,1,'line'),63)
 assert.equal(noteLineTarget(lines,0,315,630,1,'page'),283.5)
 assert.equal(noteLineTarget(lines,283.5,315,630,-1,'page'),0)
 assert.equal(noteLineTarget(lines,630,315,630,1,'line'),630)
 assert.equal(noteLineTarget(lines,0,315,630,-1,'line'),0)
 assert.equal(noteLineTarget([0],0,315,0,1,'page'),0)
 const queue=nextNoteNavigation(nextNoteNavigation([],1),-1,'page')
 assert.deepEqual(queue.map(c=>[c.sequence,c.direction,c.unit]),[[1,1,'line'],[2,-1,'page']])
})
test('Note operator/projector keys are content scoped; editing and dialogs stay native', () => {
 for (const publicWindow of [false,true]) {
  for (const [key,expected] of [['ArrowDown','NEXT'],['ArrowUp','PREVIOUS'],['PageDown','NOTE_PAGE_NEXT'],['PageUp','NOTE_PAGE_PREVIOUS'],['ArrowLeft',null]])
   assert.equal(keyboardShortcut({key},{mode:'NOTE',publicWindow}),expected)
  assert.equal(keyboardShortcut({key:'ArrowDown',target:{closest:()=>true}},{mode:'NOTE',publicWindow}),null)
  assert.equal(keyboardShortcut({key:'PageDown'},{mode:'NOTE',publicWindow,modalOpen:true}),null)
  for (const mode of ['SONG','BIBLE','REGULAR_EVENTS']) assert.equal(keyboardShortcut({key:'PageDown'},{mode,publicWindow}),null)
 }
})

test('viewport steps prefer whole blocks, retain overlap, and advance through oversized paragraphs', () => {
 const lines=Array.from({length:60},(_,i)=>i*30)
 assert.equal(noteViewportTarget(lines,[480,960],0,300,1500,1),180)
 assert.equal(noteViewportTarget(lines,[480,960],180,300,1500,-1),0)
 assert.equal(noteViewportTarget(lines,[1800],0,300,1500,1),270)
 assert.equal(noteViewportTarget(lines,[1800],1500,300,1500,1),1500)
 assert.equal(noteViewportTarget(lines,[1800],0,300,1500,-1),0)
 assert.equal(noteViewportTarget([0],[30],0,300,0,1),0)
})
