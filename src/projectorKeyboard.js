export function keyboardShortcut(event, { mode, canSend = false, modalOpen = false, publicWindow = false }) {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || modalOpen) return null
  const target = event.target
  const targets = event.composedPath?.() || [target]
  if (targets.some((node) => node?.isContentEditable || node?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="combobox"], [role="spinbutton"], [role="slider"], [role="listbox"], .modal, .modal-overlay, [aria-modal="true"]'))) return null
  if (!publicWindow && mode === 'SIDE_NAV') {
    if (event.key === 'ArrowDown') return 'SIDEBAR_NEXT'
    if (event.key === 'ArrowUp') return 'SIDEBAR_PREVIOUS'
    if (event.key === 'Enter') return event.repeat ? null : 'SIDEBAR_OPEN'
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === ' ') return null
  }
  const listPanel = !publicWindow && (mode === 'SONG_LIBRARY' || mode === 'WORKING_SERVICE')
  if (listPanel) {
    const prefix = mode === 'SONG_LIBRARY' ? 'LIBRARY' : 'SERVICE'
    if (event.key === 'ArrowDown') return `${prefix}_NEXT`
    if (event.key === 'ArrowUp') return `${prefix}_PREVIOUS`
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === ' ') return null
    // A focused row activates the highlighted item, while action buttons retain
    // their native behavior (including explicit service reorder controls).
    const control = target?.closest?.('button, a, [role="button"], [role="link"], summary')
    if (event.key === 'Enter' && !event.repeat && (!control || control.hasAttribute?.('data-keyboard-song'))) return `${prefix}_SELECT`
  }
  // Preserve native button/link activation and list-item Enter/Space handlers.
  if ((event.key === 'Enter' || event.key === ' ') && target?.closest?.('button, a, [role="button"], [role="link"], summary')) return null
  const key = event.key.toLowerCase()
  if ((key === 'b' || key === 'c' || key === 'enter') && event.repeat) return null
  if (!publicWindow && mode === 'EVENTS_LIST') {
    if (event.key === 'ArrowDown') return 'EVENT_LIST_NEXT'
    if (event.key === 'ArrowUp') return 'EVENT_LIST_PREVIOUS'
    if (event.key === 'Enter') return 'EVENT_LIST_EDIT'
    if (event.key === 'ArrowLeft') return 'PREVIOUS'
    if (event.key === 'ArrowRight') return 'NEXT'
    if (event.key === ' ') return null
  }
  if (key === 'b') return 'BLACK'
  if (key === 'c') return 'CLEAR'
  if (!publicWindow && mode === 'ADMIN_LIST') {
    if (event.key === 'ArrowDown') return 'ADMIN_NEXT'
    if (event.key === 'ArrowUp') return 'ADMIN_PREVIOUS'
    if (event.key === 'Enter') return 'ADMIN_SELECT'
    return null
  }
  if (key === 'enter') return !publicWindow && canSend ? 'SEND' : null
  if (!mode) return null
  if (mode === 'NOTE') return event.key === 'PageDown' ? 'NOTE_PAGE_NEXT' : event.key === 'PageUp' ? 'NOTE_PAGE_PREVIOUS' : event.key === 'ArrowUp' ? 'PREVIOUS' : event.key === 'ArrowDown' ? 'NEXT' : null
  if (mode === 'REGULAR_EVENTS' || mode === 'BIRTHDAY_LIST') {
    return event.key === 'ArrowUp' ? 'PREVIOUS' : event.key === 'ArrowDown' ? 'NEXT' : null
  }
  if (event.key === 'ArrowLeft') return 'PREVIOUS'
  if (event.key === 'ArrowRight' || event.key === ' ') return 'NEXT'
  if (event.key === 'ArrowUp') return mode === 'SONG' && !publicWindow ? 'SCROLL_UP' : mode === 'BIBLE' ? 'PREVIOUS' : null
  if (event.key === 'ArrowDown') return mode === 'SONG' && !publicWindow ? 'SCROLL_DOWN' : mode === 'BIBLE' ? 'NEXT' : null
  return null
}

export function presentationMode(contentType, events = []) {
  if (contentType === 'EVENT') return events[0]?.eventType === 'BIRTHDAY_LIST' ? 'BIRTHDAY_LIST' : 'REGULAR_EVENTS'
  return contentType === 'NOTE' ? 'NOTE' : contentType === 'BIBLE' ? 'BIBLE' : 'SONG'
}
