export const NOTE_LIMIT = 2000
export function selectedEvents(events, ids) {
  return ids === null ? events : events.filter(event => ids.includes(event.id))
}
export function liveVerseIndex(passage, value) {
  const input = String(value).trim()
  if (!/^\d+$/.test(input) || !Number.isSafeInteger(Number(input)) || Number(input) < 1) return -1
  return passage?.verses?.findIndex(verse => verse.verseNumber === Number(input)) ?? -1
}
export function noteValidation(text) {
  if (!text.trim()) return 'Enter a note before previewing.'
  if (text.length > NOTE_LIMIT || text.split('\n').length > 40) return 'Use up to 2000 characters and 40 lines per note.'
  return ''
}
