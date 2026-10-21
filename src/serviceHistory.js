export function mapWorkingServicePlans(plans, update) {
  return plans.map(plan => plan.status === 'COMPLETED' ? plan : update(plan))
}

export function canReuseHistory(plan) {
  return Boolean(plan && plan.snapshotReadable !== false && !(plan.songs || []).some(song => song?.missingHistoryContent))
}

export function historyPreservationMessage(plan) {
  if (plan?.snapshotReadable === false) return 'Original historical payload retained. This format needs recovery before it can be displayed or reused.'
  if ((plan?.songs || []).some(song => song?.missingHistoryContent)) return 'Some historical song contents were already missing. Source IDs are retained; recover those contents before reuse.'
  if (plan?.snapshotProvenance === 'RECOVERED_AT_MIGRATION') return 'Reconstructed from song records during migration. Original performance-time lyrics may differ.'
  if (plan?.snapshotProvenance === 'CAPTURED_AT_COMPLETION') return 'Contents saved when this service was completed.'
  return 'Existing historical contents retained.'
}
