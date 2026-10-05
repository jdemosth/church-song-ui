const months = Array.from({ length: 12 }, (_, index) =>
  new Date(2000, index, 1).toLocaleString('en-US', { month: 'short' }))

export function validateEventDates(startDate, endDate) {
  if (!startDate) return 'Start Date is required.'
  if (endDate && endDate < startDate) return 'End Date cannot be earlier than Start Date.'
  return ''
}

export function isUpcomingEvent(event, today) {
  return (event.endDate || event.eventDate) >= today
}

export function formatEventDateRange(startDate, endDate) {
  if (!startDate) return 'No date'
  const [year, month, day] = startDate.split('-').map(Number)
  // Keep the existing single-date format for legacy events.
  if (!endDate || endDate === startDate) {
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
  const start = `${months[month - 1]} ${day}`
  const end = `${months[endMonth - 1]} ${endDay}`
  if (year !== endYear) return `${start}, ${year} - ${end}, ${endYear}`
  if (month !== endMonth) return `${start} - ${end}, ${year}`
  return `${start} - ${endDay}, ${year}`
}
