import test from 'node:test'
import assert from 'node:assert/strict'
import { bibleProjectorBlocks } from '../src/bibleProjectorBlocks.js'
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
