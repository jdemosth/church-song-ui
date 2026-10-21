import { API_BASE_URL } from './apiOrigin.js'
const nativeFetch = window.fetch.bind(window)
let generation = 0
let csrf
let expectedChurch
export function setExpectedChurch(id) { expectedChurch = id }
export function expireRequests() { generation++; csrf = null }
export async function authFetch(path, options = {}) {
  const lease = generation
  const url = new URL(path, window.location.origin)
  const api = new URL(API_BASE_URL || window.location.origin)
  if (url.origin !== api.origin) return nativeFetch(path, options)
  const method = (options.method || 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  if (expectedChurch) headers.set("X-BOC-Church", String(expectedChurch))
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !(import.meta.env.DEV && import.meta.env.VITE_STANDALONE_FIXTURES === 'true')) {
    if (!csrf) csrf = nativeFetch(`${API_BASE_URL}/auth/csrf`, { credentials: 'include', cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('Session unavailable'); return r.json() })
    const token = await csrf
    headers.set(token.headerName, token.token)
  }
  if (lease !== generation) throw new Error('Session changed')
  const response = await nativeFetch(path, { ...options, headers, credentials: 'include', cache: 'no-store' })
  if (lease !== generation) throw new Error('Session changed')
  if (response.status === 401 || response.status === 403) window.dispatchEvent(new CustomEvent('boc-access-denied', { detail: response.status }))
  return response
}
window.fetch = authFetch
