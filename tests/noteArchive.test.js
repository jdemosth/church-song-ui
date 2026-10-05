import test from 'node:test'
import assert from 'node:assert/strict'
import { archivePayload, ARCHIVE_LIMIT } from '../src/noteArchive.js'
import { noteValidation } from '../src/operatorFeatures.js'
test('archive payload preserves full text and metadata without accepting record identity or creation time',()=>{
 const text='Ésaïe\n\n  1. Première réflexion\n'+ 'book material '.repeat(2000)
 const data=archivePayload({id:7,title:'Teaching',createdAt:'old',noteDate:'2026-09-22',servicePlanId:12,updatedAt:'revision',tags:'faith, hope'},text)
 assert.equal(data.content,text);assert.equal(data.servicePlanId,12);assert.equal(data.updatedAt,'revision');assert.equal(data.id,undefined);assert.equal(data.createdAt,undefined)
 assert.equal(data.tags,'faith, hope');assert(text.length<ARCHIVE_LIMIT)
 assert(noteValidation(text),'archive capacity does not weaken projector limits')
})
test('new standalone notes can omit every metadata field except title/content',()=>{
 const note=archivePayload({},'Content')
 assert.equal(note.servicePlanId,null);assert.equal(note.noteDate,null);assert.equal(note.updatedAt,null)
})

test('simplified form preserves topic and hidden metadata on existing note edits',()=>{
 const metadata={title:'Teaching',noteDate:'2026-09-22',topic:'Faith',speakerOrAuthor:'Author',scriptureReference:'John 3',tags:'faith',servicePlanId:12,updatedAt:'revision'}
 const payload=archivePayload(metadata,'Edited body')
 for(const [key,value] of Object.entries(metadata)) assert.equal(payload[key],value)
 assert.equal(payload.content,'Edited body')
})
