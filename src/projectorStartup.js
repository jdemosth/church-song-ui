// A fresh projector route restores appearance, not a previous live presentation.
// Both BroadcastChannel and storage updates pass through the same session gate.
export function createProjectorStartupGate(startedAt, previousSendId) {
  let acceptedSendId = null
  return (state) => {
    const send = state.liveSend
    if (send?.id && send.id !== previousSendId && send.issuedAt >= startedAt) {
      acceptedSendId = send.id
    }
    if (acceptedSendId && send?.id === acceptedSendId) return state
    return {
      ...state,
      projectionMode: state.projectionMode === 'BLACK' ? 'BLACK' : 'CLEAR',
      projectedNote: '',
      projectionSong: null,
      projectedBiblePassage: null,
      projectedEvent: null,
      projectedEvents: [],
      sectionIndex: 0,
      projectedBibleVerseIndex: 0,
      projectedEventPageIndex: 0,
    }
  }
}

// Reconnecting operators can synchronize appearance without publishing cached content.
export function projectorAppearanceState(state) {
  return Object.fromEntries([
    'backgroundType', 'backgroundVariant', 'customBackgroundId',
    'customBackgroundName', 'projectionSettings',
  ].filter(key => key in state).map(key => [key, state[key]]))
}
