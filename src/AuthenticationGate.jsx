import { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { API_BASE_URL } from './apiOrigin.js'
import { authFetch, expireRequests, setExpectedChurch } from './authenticatedFetch.js'
import { configureBrowserScope } from './browserScope.js'
import ProjectorSessionPicker from './ProjectorSessionPicker.jsx'
import SharedSongLibrary from './SharedSongLibrary.jsx'
const App = lazy(() => import('./App.jsx'))
export default function AuthenticationGate() {
  function announceSessionChange() { window.localStorage.setItem('boc-session-revision', crypto.randomUUID()) }
  const [session, setSession] = useState(null)
  const [message, setMessage] = useState('')
  const [denied, setDenied] = useState(false)
  const [projectorSession, setProjectorSession] = useState(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const selectProjector = useCallback(id => { const url = new URL(location.href); url.searchParams.set('session', id); history.replaceState(null,'',url); setProjectorSession(id) }, [])
  const [token, setToken] = useState('')
  const sessionUserId = session?.userId
  const sessionChurchId = session?.churchId
  useEffect(() => {
    let active = true
    authFetch(`${API_BASE_URL}/auth/session`).then(r => { if (!r.ok) throw Error('Sign in unavailable'); return r.json() }).then(s => {
      if (!active) return
      // Local fixture mode is explicit, available only in the Vite development server.
      if (import.meta.env.DEV && import.meta.env.VITE_STANDALONE_FIXTURES === 'true') s = { mode: 'standalone', authorized: true }
      setExpectedChurch(s.churchId); setSession(s)
    }).catch(e => { if (active) setMessage(e.message) })
    const revoke = event => { expireRequests(); setDenied(true); setMessage(event.detail === 401 ? 'Your session ended. Sign in again.' : 'Access denied. Your account cannot perform this action.') }
    window.addEventListener('boc-access-denied', revoke)
    // Recheck cookies/membership after another tab logs out or changes church.
    const check = () => authFetch(`${API_BASE_URL}/auth/session`).then(r => r.json()).then(s => {
      if (s.mode === 'hosted' && sessionUserId != null && (s.userId !== sessionUserId || s.churchId !== sessionChurchId || !s.authorized)) location.reload()
    }).catch(() => setDenied(true))
    const changed = event => { if (event.key === 'boc-session-revision') { expireRequests(); location.reload() } }
    window.addEventListener('storage', changed)
    window.addEventListener('focus', check)
    const timer = window.setInterval(check, 30000)
    return () => { window.removeEventListener('storage', changed); window.clearInterval(timer); active = false; window.removeEventListener('boc-access-denied', revoke); window.removeEventListener('focus', check) }
  }, [sessionUserId, sessionChurchId])
  async function logout() {
    const response = await authFetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' })
    if (!response.ok) { setMessage('Logout failed. Please try again.'); return }
    announceSessionChange(); expireRequests(); setSession(null); setDenied(true)
    const providerLogout = response.headers.get('X-BOC-Logout-URL')
    if (providerLogout) location.assign(providerLogout)
    else location.reload()
  }
  async function select(churchId) {
    const r = await authFetch(`${API_BASE_URL}/auth/church`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ churchId: Number(churchId) }) })
    if (r.ok) { announceSessionChange(); expireRequests(); location.reload() }
  }
  async function accept(event) {
    event.preventDefault()
    const r = await authFetch(`${API_BASE_URL}/auth/invitations/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
    if (r.ok) { announceSessionChange(); location.reload() } else setMessage('Invitation is unavailable, expired, or belongs to another email address.')
  }
  if (session?.authorized && !denied && session.mode === 'hosted' && !projectorSession) return <><ProjectorSessionPicker onSelect={selectProjector} /><button onClick={logout}>Sign out</button></>
  if (session?.authorized && !denied) {
    configureBrowserScope({ ...session, projectorSession })
    return <>
    {session.mode === 'hosted' && !new URLSearchParams(location.search).has('projector') && <div role="region" aria-label="Account"><span>{session.email}</span> <select aria-label="Church" value={session.churchId} onChange={e => select(e.target.value)}>{session.churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select> <button onClick={logout}>Sign out</button></div>}
    {session.mode === 'hosted' && !new URLSearchParams(location.search).has('projector') && <div><button onClick={() => setLibraryOpen(v => !v)}>Shared songs</button><button onClick={() => { const url=new URL(location.href);url.searchParams.delete('session');location.href=url.toString() }}>Choose another projector session</button><button onClick={async () => { const r=await authFetch(`${API_BASE_URL}/projector/sessions/${projectorSession}`,{method:'DELETE'}); if(r.ok){const url=new URL(location.href);url.searchParams.delete('session');location.href=url.toString()} }}>Close projector session</button><p>Session link: <a href={location.href}>{projectorSession}</a></p></div>}
    {libraryOpen && <SharedSongLibrary platformAdmin={session.platformAdmin} onClose={() => {setLibraryOpen(false);location.reload()}} />}
    <Suspense fallback={<p>Loading WorshipView…</p>}><App /></Suspense>
  </> }

  return <main style={{ maxWidth: 480, margin: '10vh auto', padding: 24 }}>
    <h1>BOC WorshipView</h1><h2>{denied ? 'Access denied' : 'Invitation-only access'}</h2>
    {message && <p role="alert">{message}</p>}
    {!session && !message && <p>Checking your session…</p>}
    <a href={`${API_BASE_URL}/oauth2/authorization/cognito`}>Sign in</a>
    {session?.development && <form onSubmit={async e => { e.preventDefault(); const r = await authFetch(`${API_BASE_URL}/auth/development-login`, { method: 'POST', body: new URLSearchParams(new FormData(e.currentTarget)) }); if (r.ok) { announceSessionChange(); expireRequests(); location.reload() } else setMessage('Sign in failed') }}><label>Email <input name="username" type="email" required autoComplete="username" /></label><label>Password <input name="password" type="password" required autoComplete="current-password" /></label><button>Development sign in</button></form>}
    {session?.platformAdmin && <SharedSongLibrary platformAdmin platformOnly />}
    {session?.userId && <><p>Select an invited church or accept an invitation.</p><select aria-label="Select church" defaultValue="" onChange={e => select(e.target.value)}><option value="" disabled>Select church</option>{session.churches?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><form onSubmit={accept}><label>Invitation token <input value={token} onChange={e => setToken(e.target.value)} required /></label><button>Accept invitation</button></form><button onClick={logout}>Sign out</button></>}
  </main>
}
