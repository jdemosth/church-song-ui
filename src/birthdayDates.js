const months = Array.from({ length: 12 }, (_, index) =>
  new Date(2000, index, 1).toLocaleString('en-US', { month: 'short' }))

export function birthdayDateLabel(person) {
  const month = months[person.month - 1] || ''
  const birthYear = String(person.birthYear ?? '').trim()
  return `${month} ${person.day}${birthYear ? `, ${birthYear}` : ''}`
}
