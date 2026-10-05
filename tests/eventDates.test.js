import test from 'node:test'
import assert from 'node:assert/strict'
import { formatEventDateRange, validateEventDates, isUpcomingEvent } from '../src/eventDates.js'

test('formats compact ranges with short months, plain days, and hyphens', () => {
  assert.equal(formatEventDateRange('2026-11-12', '2026-11-14'), 'Nov 12 - 14, 2026')
  assert.equal(formatEventDateRange('2026-09-17', '2026-09-20'), 'Sep 17 - 20, 2026')
  assert.equal(formatEventDateRange('2026-09-30', '2026-10-02'), 'Sep 30 - Oct 2, 2026')
  assert.equal(formatEventDateRange('2026-12-31', '2027-01-02'), 'Dec 31, 2026 - Jan 2, 2027')
  assert.equal(formatEventDateRange('2026-09-17', '2026-09-17'), 'Sep 17, 2026')
})

test('preserves legacy single-date formatting for omitted or empty end dates', () => {
  for (const end of [undefined, null, '']) {
    assert.equal(formatEventDateRange('2026-09-17', end), 'Sep 17, 2026')
  }
})

test('requires start date and rejects reversed ranges, allowing same-day events', () => {
  assert.equal(validateEventDates('', ''), 'Start Date is required.')
  assert.equal(validateEventDates('2026-09-20', '2026-09-17'), 'End Date cannot be earlier than Start Date.')
  for (const end of ['', null, '2026-11-12', '2027-01-02']) {
    assert.equal(validateEventDates('2026-11-12', end), '')
  }
})

test('includes ongoing events until their final day and preserves single-day filtering', () => {
  const event = { eventDate: '2026-11-12', endDate: '2026-11-14' }
  assert.equal(isUpcomingEvent(event, '2026-11-13'), true)
  assert.equal(isUpcomingEvent(event, '2026-11-14'), true)
  assert.equal(isUpcomingEvent(event, '2026-11-15'), false)
  assert.equal(isUpcomingEvent({ eventDate: '2026-11-12' }, '2026-11-12'), true)
  assert.equal(isUpcomingEvent({ eventDate: '2026-11-12' }, '2026-11-13'), false)
})
