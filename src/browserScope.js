let scope = ''
let hosted = false
let projectorSession = null
export function selectedProjectorSession() { return projectorSession }
export function configureBrowserScope(session) {
  hosted = session.mode === 'hosted'
  projectorSession = session.projectorSession || null
  scope = hosted ? `boc:u${session.userId}:c${session.churchId}:` + (projectorSession ? `p${projectorSession}:` : '') : ''
}
export function scopedKey(key) { return scope + key }
export function isHosted() { return hosted }
export const scopedStorage = {
  getItem: key => window.localStorage.getItem(scopedKey(key)),
  setItem: (key, value) => window.localStorage.setItem(scopedKey(key), value),
  removeItem: key => window.localStorage.removeItem(scopedKey(key)),
}
export function storageEventKey(event) {
  return event.key?.startsWith(scope) ? event.key.slice(scope.length) : null
}
export function ScopedBroadcastChannel(name) { return new window.BroadcastChannel(scopedKey(name)) }
