import test from 'node:test'
import assert from 'node:assert/strict'
import { birthdayDateLabel } from '../src/birthdayDates.js'

test('shows each person’s birth year, never the list display year', () => {
  const list = { displayYear: 2026, birthdayEntries: [
    { name: 'Kephtania Alezie', month: 9, day: 12, birthYear: 1995 },
    { name: 'Jean Kennedy Demosthene', month: 9, day: 28, birthYear: 1965 },
    { name: 'Marie Pierre', month: 9, day: 30, birthYear: null },
  ] }
  assert.deepEqual(list.birthdayEntries.map(person => birthdayDateLabel(person, list.displayYear)),
    ['Sep 12, 1995', 'Sep 28, 1965', 'Sep 30'])
})

test('empty or omitted birth years do not produce a year or trailing punctuation', () => {
  for (const birthYear of [undefined, null, '', '   ']) {
    assert.equal(birthdayDateLabel({ month: 9, day: 30, birthYear }), 'Sep 30')
  }
  assert.equal(birthdayDateLabel({ month: 9, day: 12, birthYear: 2026 }), 'Sep 12, 2026')
  assert.equal(birthdayDateLabel({ month: 9, day: 12, birthYear: '1995' }), 'Sep 12, 1995')
})
