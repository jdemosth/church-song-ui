import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createNetworkProjector } from '../src/networkProjector.js'
// Inject Vite's compile-time flag for isolated Node tests. The browser test
// independently checks the actual Vite output without modifying its assertion.
async function apiBaseUrl(development, hostname = 'localhost') {
  const source = readFileSync(new URL('../src/apiOrigin.js', import.meta.url), 'utf8')
  const module = await import('data:text/javascript,' + encodeURIComponent(
    source.replaceAll('import.meta.env.DEV', JSON.stringify(development))
      .replaceAll('window.location.hostname', JSON.stringify(hostname))))
  return module.API_BASE_URL
}

test('production API and media paths resolve to the page server, not this computer', async () => {
  for (const origin of ['http://192.168.1.50:8080', 'http://hmga-server:8080']) {
    for (const path of ['/songs', '/songs/1', '/song-families/1/versions', '/playlists', '/service-plans', '/events', '/settings', '/bible/passage', '/songs/1/melody-reference/audio', '/admin/backup/database']) {
      assert.equal(new URL((await apiBaseUrl(false)) + path, origin).origin, origin)
    }
  }
})
test('Vite development keeps its existing localhost API origin', async () => {
  assert.equal(await apiBaseUrl(true), 'http://localhost:8080')
})
test('application requests contain no absolute localhost dependency', () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert(!source.includes('http://localhost:8080'))
  assert(source.includes('`${API_BASE_URL}${audioPath}`'))
})

test('development API follows LAN IPs, DNS names and IPv6 without a fixed host', async () => {
  for (const hostname of ['192.168.1.50', '10.20.30.40', 'macbook.local', '127.0.0.1', '[::1]']) {
    assert.equal(await apiBaseUrl(true, hostname), `http://${hostname}:8080`)
    assert.equal(await apiBaseUrl(false, hostname), '')
  }
})
test('capabilities and WebSocket share the resolved development or production server', async () => {
  for (const [dev, origin, expected] of [
    [true, 'http://localhost:5173', 'http://localhost:8080'],
    [true, 'http://192.168.1.50:5173', 'http://192.168.1.50:8080'],
    [false, 'http://192.168.1.50:8080', 'http://192.168.1.50:8080'],
    [false, 'https://church.example', 'https://church.example'],
  ]) {
    let capabilityUrl, socketUrl
    class Socket { constructor(url) { socketUrl = url.href } close() {} }
    const baseUrl = await apiBaseUrl(dev, new URL(origin).hostname)
    const transport = createNetworkProjector({ baseUrl, origin, role: 'PROJECTOR', Socket,
      fetcher: async url => { capabilityUrl = new URL(url, origin).href; return { ok: true, json: async () => ({ protocol: 'church-projector-v1' }) } },
    })
    try {
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(capabilityUrl, expected + '/projector/capabilities')
      assert.equal(socketUrl, expected.replace(/^http/, 'ws') + '/projector/ws')
    } finally { transport.close() }
  }
})
