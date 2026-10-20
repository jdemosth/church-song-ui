import test from 'node:test'
import assert from 'node:assert/strict'
import { bibleProjectorBlocks, findCreoleTranslation, contiguousVerseRanges } from '../src/bibleProjectorBlocks.js'
test('Bible blocks use snapshot text, English then French, with individual references', () => {
 const p={projectionMode:'FRENCH_ENGLISH',chapter:3,translations:{ENGLISH:{bookName:'John'},FRENCH:{bookName:'Jean'}}}
 assert.deepEqual(bibleProjectorBlocks(p,{verseNumber:16,primaryText:'French',secondaryText:'English'}),[
 {language:'ENGLISH',text:'English',reference:'John 3:16'}, {language:'FRENCH',text:'French',reference:'Jean 3:16'}])
 assert.equal(bibleProjectorBlocks(p,{verseNumber:17,primaryText:'Available'}).length,1)
})
test('single language selections and stored text are preserved', () => {
 for(const mode of ['ENGLISH','FRENCH','SPANISH']) assert.deepEqual(bibleProjectorBlocks({projectionMode:mode,bookName:'Stored name',chapter:8,translationCode:'WEB'},{verseNumber:9,text:'Selected text'}),[{language:mode,text:'Selected text',reference:'Stored name 8:9'}])
 assert.deepEqual(bibleProjectorBlocks(null,null),[])
})
test('third-language block uses only supplied stored text and the same verse number', () => {
 const p={projectionMode:'TRILINGUAL',chapter:2,translations:{ENGLISH:{bookName:'A'},FRENCH:{bookName:'B'},HAITIAN_CREOLE:{bookName:'C'}}}
 const blocks=bibleProjectorBlocks(p,{verseNumber:7,secondaryText:'EN fixture',primaryText:'FR fixture',creoleText:'HT fixture'})
 assert.deepEqual(blocks.map(b=>b.reference),['A 2:7','B 2:7','C 2:7'])
 assert.deepEqual(blocks.map(b=>b.language),['ENGLISH','FRENCH','HAITIAN_CREOLE'])
 assert.equal(bibleProjectorBlocks(p,{verseNumber:7,primaryText:'FR fixture',secondaryText:'EN fixture'}).length,2)
})
test('Kreyòl capability comes from installed metadata, independent of the reference-language shortlist', () => {
 assert.equal(findCreoleTranslation([{code:'KJV',language:'ENGLISH'}]),null)
 const installed={code:'TEST_HT',language:'HAITIAN_CREOLE'}
 assert.deepEqual(findCreoleTranslation([{code:'KJV',language:'ENGLISH'},installed]),installed)
})
test('trilingual API requests preserve gaps in translation verse numbering', () => {
 assert.deepEqual(contiguousVerseRanges([35,37,34,37]),[[34,35],[37,37]])
 assert.deepEqual(contiguousVerseRanges([]),[])
})

test('Kreyòl display references localize legacy English snapshot names without changing content or identity', () => {
 for (const [bookKey,en,fr,ht,chapter,verseNumber] of [
  ['JOHN','John','Jean','Jan',3,16],
  ['PSALMS','Psalms','Psaumes','Sòm',91,1],
  ['GENESIS','Genesis','Genese','Jenèz',1,1],
  ['MATTHEW','Matthew','Matthieu','Matye',5,1],
  ['ACTS','Acts','Actes','Travay',2,1],
  ['REVELATION','Revelation','Apocalypse','Revelasyon',22,21],
 ]) {
  const passage={projectionMode:'TRILINGUAL',bookKey,chapter,translations:{
   ENGLISH:{bookKey,bookName:en},FRENCH:{bookKey,bookName:fr},HAITIAN_CREOLE:{bookName:en},
  }}
  const verse={verseNumber,secondaryText:'English text',primaryText:'French text',creoleText:'Unchanged Kreyòl text'}
  const original=JSON.stringify({passage,verse})
  const blocks=bibleProjectorBlocks(passage,verse)
  assert.deepEqual(blocks.map(b=>b.reference),[en,fr,ht].map(n=>`${n} ${chapter}:${verseNumber}`))
  assert.equal(blocks[2].text,verse.creoleText)
  assert.equal(JSON.stringify({passage,verse}),original)
 }
})
