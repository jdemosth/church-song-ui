// No live commands are queued. A fresh document never admits a cached live snapshot.
export function projectorId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function createNetworkProjector({ baseUrl = '', role, onState, onStatus, onError,
  fetcher = globalThis.fetch, Socket = globalThis.WebSocket, origin = globalThis.location?.origin }) {
  let socket, timer, heartbeat, handshake, connection, stopped = false, epoch, sequence = 0, revision = -1
  let contentTypes = []
  let mode = 'probing', ready = false, projectors = 0, liveId = '', admittedId = null
  let pendingPing = null, lastTick = 0, attempt = 0
  const diagnostic = (event, details = {}) => console.info('[projector-websocket]', { event, role, connection, at: new Date().toISOString(), ...details })
  const status = () => onStatus?.({ mode, ready, projectors })
  function connect() {
    if (stopped) return
    const url = new URL('/projector/ws', baseUrl || origin)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    diagnostic('connect-attempt', { attempt: ++attempt, host: url.host })
    socket = new Socket(url)
    handshake = setTimeout(() => { diagnostic('handshake-timeout'); socket.close(4002, 'Handshake timeout') }, 10000)
    socket.onopen = () => { diagnostic('open'); socket.send(JSON.stringify({ type: 'HELLO', role })) }
    socket.onmessage = event => {
      if (stopped) return
      let message
      try { message = JSON.parse(event.data) } catch { return }
      if (message.type === 'PONG') { pendingPing = null; return }
      if (message.type === 'PRESENCE') { projectors = message.projectors; status(); return }
      if (message.type === 'ERROR') { onError?.(message.message); return }
      if (message.type === 'WELCOME') {
        clearTimeout(handshake); connection = message.connection
        epoch = message.epoch; revision = message.revision; sequence = 0
        ready = true; liveId = message.state?.liveSend?.id || ''
        diagnostic(attempt > 1 ? 'reconnect-success' : 'ready')
        status()
        // Operators may observe live state. Projectors NEVER restore content on handshake.
        if (role === 'OPERATOR') onState?.(message.state, { initial: true })
        pendingPing = null; lastTick = Date.now()
        clearInterval(heartbeat)
        heartbeat = setInterval(() => {
          const now = Date.now()
          // A delayed browser callback is not evidence that the peer failed.
          // Start a fresh probe after suspension, then measure its response deadline.
          if (now-lastTick > 10000) pendingPing = null
          lastTick = now
          if (pendingPing !== null && now-pendingPing >= 15000) {
            diagnostic('heartbeat-timeout'); socket.close(4000, 'Heartbeat response timeout'); return
          }
          if (pendingPing === null && socket.readyState === 1) {
            pendingPing = now; socket.send(JSON.stringify({ type: 'PING' }))
          }
        }, 5000)
        return
      }
      if (message.type !== 'STATE' || message.epoch !== epoch || message.revision <= revision) return
      revision = message.revision
      liveId = message.state?.liveSend?.id || ''
      if (role === 'PROJECTOR' || role === 'VIEWER') {
        if (message.action === 'SEND_LIVE') admittedId = liveId
        if (!admittedId || admittedId !== liveId) {
          // Allow appearance/black controls while blank, without admitting cached lyrics.
          if (['BLACK_SCREEN', 'CLEAR_LYRICS', 'SHOW_LYRICS', 'BACKGROUND_CHANGE'].includes(message.action)) {
            onState?.(message.state, { appearanceOnly: true, action: message.action })
          }
          return
        }
      }
      onState?.(message.state, { action: message.action })
    }
    socket.onerror = () => { if (!stopped) { diagnostic('error', { readyState: socket.readyState }); onError?.('Projector connection interrupted. The current display is preserved.') } }
    socket.onclose = (event = {}) => {
      diagnostic('closed', { code: event.code, reason: event.reason, clean: event.wasClean, intentional: stopped })
      if (stopped) return
      ready = false; projectors = 0; clearTimeout(handshake); clearInterval(heartbeat); status()
      if (!stopped) {
        onError?.('Projector connection interrupted. The current display is preserved.')
        diagnostic('reconnect-scheduled', { delayMs: 1500 })
        timer = setTimeout(connect, 1500)
      }
    }
  }
  const controller = new AbortController()
  // Unsupported servers retain the established local transport. Network errors do not
  // silently change transport: retry discovery, since the LAN server may be restarting.
  async function discover() {
    try {
      const response = await fetcher(`${baseUrl}/projector/capabilities`, { cache: 'no-store', signal: controller.signal })
      if (!response.ok && ![404, 501].includes(response.status)) throw new Error('Projector server unavailable')
      const value = response.ok ? await response.json() : null
      if (stopped) return
      if (value?.protocol !== 'church-projector-v1') { mode = 'local'; status(); return }
      contentTypes = Array.isArray(value.contentTypes) ? value.contentTypes : []
      mode = 'network'; status(); connect()
    } catch {
      if (stopped) return
      onError?.('Waiting for the projector server connection.')
      timer = setTimeout(discover, 1500)
    }
  }
  discover()
  return {
    get mode() { return mode },
    get ready() { return ready },
    get connection() { return connection },
    get projectors() { return projectors },
    supportsContent(type) { return mode === 'local' || contentTypes.includes(type) },
    command(action, payload = {}) {
      if (mode === 'local') return false
      if (!ready || socket?.readyState !== 1) {
        onError?.('Projector server is not connected. Reconnect, then repeat the action.')
        return true
      }
      socket.send(JSON.stringify({ type: 'COMMAND', epoch, connection, sequence: ++sequence, action, liveId, payload }))
      return true
    },
    close() { stopped = true; controller.abort(); clearTimeout(timer); clearTimeout(handshake); clearInterval(heartbeat); socket?.close() },
  }
}


// Browser-local blob URLs cannot be transported to another computer.
export function networkBackgroundFile(file) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
    return Promise.reject(new Error('Network backgrounds must be PNG, JPEG or WebP images up to 1 MB.'))
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read the selected projector background.'))
    reader.readAsDataURL(file)
  })
}
