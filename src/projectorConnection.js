import { scopedStorage, storageEventKey, ScopedBroadcastChannel } from './browserScope.js'
import { projectorId } from './networkProjector'
const CHANNEL = 'church-song-projector'
const PRESENCE_KEY = 'church-song-projector-presence'
const PING = 'PROJECTOR_PING'
const READY = 'PROJECTOR_READY'
const PONG = 'PROJECTOR_PONG'

// Presence uses the existing channel, with the same storage-event fallback.
function presenceTransport(onMessage) {
  const channel = 'BroadcastChannel' in window ? new ScopedBroadcastChannel(CHANNEL) : null
  const receive = (event) => onMessage(event.data)
  const storage = (event) => {
    if (storageEventKey(event) !== PRESENCE_KEY || !event.newValue) return
    try { onMessage(JSON.parse(event.newValue)) } catch { /* Ignore malformed messages. */ }
  }
  channel?.addEventListener('message', receive)
  if (!channel) window.addEventListener('storage', storage)
  return {
    post(message) {
      if (channel) channel.postMessage(message)
      else {
        try {
          scopedStorage.setItem(PRESENCE_KEY, JSON.stringify({ ...message, nonce: projectorId() }))
        } catch { /* The handshake times out when neither transport is available. */ }
      }
    },
    close() {
      channel?.close()
      window.removeEventListener('storage', storage)
    },
  }
}

// Called after the projector has installed its content listeners.
export function announceProjectorReady() {
  const transport = presenceTransport((message) => {
    if (message?.type === PING) transport.post({ type: PONG, requestId: message.requestId })
  })
  transport.post({ type: READY })
  return () => transport.close()
}

export function createProjectorConnection(openWindow) {
  let disposed = false
  let pending = null
  let openedWindow = null
  let waitForReply = null
  const transport = presenceTransport((message) => {
    if (message?.type === PONG && message.requestId === waitForReply?.id) {
      waitForReply.finish(true)
    } else if (message?.type === READY) {
      // READY triggers a correlated ping, so an old announcement is never presence.
      if (waitForReply) transport.post({ type: PING, requestId: waitForReply.id })
    }
  })

  function probe(timeout) {
    return new Promise((resolve) => {
      const id = projectorId()
      const interval = window.setInterval(() => transport.post({ type: PING, requestId: id }), 150)
      const timer = window.setTimeout(() => finish(false), timeout)
      function finish(ready) {
        window.clearInterval(interval)
        window.clearTimeout(timer)
        waitForReply = null
        resolve(ready)
      }
      waitForReply = { id, finish }
      transport.post({ type: PING, requestId: id })
    })
  }

  return {
    ensureReady() {
      if (pending) return pending
      pending = (async () => {
        // Retry before opening: a busy but connected projector must be reused.
        const connected = await probe(600)
        if (disposed) throw new Error('Projector connection was cancelled.')
        if (connected) return
        if (!openedWindow || openedWindow.closed) {
          try { openedWindow = openWindow() } catch { openedWindow = null }
          if (!openedWindow) throw new Error('Projector window could not be opened. Click Connect Projector.')
        }
        openedWindow.focus()
        if (!await probe(5000)) {
          throw new Error('Projector did not become ready. Click Connect Projector and try again.')
        }
      })().finally(() => { pending = null })
      return pending
    },
    close() {
      disposed = true
      waitForReply?.finish(false)
      transport.close()
    },
  }
}
