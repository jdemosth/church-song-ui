import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL } from './apiOrigin.js'
export default function SharedSongLibrary({ platformAdmin, platformOnly = false, onClose }) {
  const [catalog,setCatalog] = useState([]), [submitted,setSubmitted] = useState([]), [queue,setQueue] = useState([]), [songs,setSongs] = useState([])
  const [songId,setSongId] = useState(''), [message,setMessage] = useState(''), [query,setQuery] = useState('')
  const reload = useCallback(async () => {
    try {
      async function load(path) { const r = await fetch(`${API_BASE_URL}${path}`); if (!r.ok) throw Error('Library unavailable'); return r.json() }
      if (!platformOnly) { const [c,s,own] = await Promise.all([load('/library/revisions'),load('/library/submissions'),load('/songs')]); setCatalog(c); setSubmitted(s); setSongs(own) }
      if (platformAdmin) setQueue(await load('/moderation/songs'))
    } catch (e) { setMessage(e.message) }
  }, [platformAdmin, platformOnly])
  useEffect(() => { let active = true; Promise.resolve().then(() => { if (active) reload() }); return () => { active = false } }, [reload])
  async function action(path, body) {
    try { const r = await fetch(`${API_BASE_URL}${path}`,{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body || {}) }); if (!r.ok) throw Error((await r.json()).message || 'Action failed; reload the exact revision'); setMessage('Saved. Reload the working library to see imported songs.'); await reload() } catch (e) { setMessage(e.message) }
  }
  return <section aria-label="Shared song library" style={{padding:24,background:'#fff',color:'#111'}}><h2>Shared song library</h2>{onClose && <button onClick={onClose}>Close shared library</button>}{message && <p role="status">{message}</p>}
    {!platformOnly && <><label>Search approved songs <input value={query} onChange={e => setQuery(e.target.value)} /></label><p>Using a song pins this exact approved revision in your church library. Pending edits stay private.</p>
      {catalog.filter(r => r.song.title.toLowerCase().includes(query.toLowerCase())).map(r => <article key={r.id}><h3>{r.song.title} · {r.song.language} · revision #{r.id}</h3><pre style={{whiteSpace:'pre-wrap'}}>{r.song.lyrics}</pre><button onClick={() => action(`/library/revisions/${r.id}/use`)}>Use revision #{r.id}</button>{r.hasAudio && <audio controls src={`${API_BASE_URL}/library/revisions/${r.id}/audio`} />}</article>)}
      <h3>Submit a church song</h3><label>Song <select aria-label="Song" value={songId} onChange={e => setSongId(e.target.value)}><option value="">Select by ID</option>{songs.map(s => <option key={s.id} value={s.id}>{s.title} · {s.language} · song #{s.id}</option>)}</select></label><button disabled={!songId} onClick={() => action(`/songs/${songId}/submit`)}>Submit exact contents</button>
      <h3>Church submissions</h3>{submitted.map(r => <article key={r.id}><strong>{r.song.title} · revision #{r.id} · {r.status}</strong><p>{r.rejection_reason}</p><p>Submitted {r.submitted_at}; reviewer {r.reviewer_id || 'pending'} {r.reviewed_at}</p>{r.status === 'PENDING' && <button onClick={() => action(`/library/revisions/${r.id}/withdraw`)}>Withdraw revision #{r.id}</button>}<button onClick={() => action(`/songs/${r.song_id}/submit`)}>Resubmit current song #{r.song_id}</button><button onClick={() => action(`/songs/${r.song_id}/archive-submission`)}>Archive submission</button></article>)}</>}
    {platformAdmin && <><h3>Platform moderation</h3>{queue.map(r => <article key={r.id}><h4>{r.song.title} · revision #{r.id} · church #{r.church_id}</h4><p>Submitter #{r.submitter_id}; {r.submitted_at}</p><pre style={{whiteSpace:'pre-wrap'}}>{r.song.lyrics}</pre>{r.hasAudio && <audio controls src={`${API_BASE_URL}/moderation/songs/${r.id}/audio`} />}<p>Checksum: {r.checksum}</p><button onClick={() => action(`/moderation/songs/${r.id}/review`,{checksum:r.checksum,decision:'APPROVED'})}>Approve revision #{r.id}</button><button onClick={() => { const reason = window.prompt('Rejection reason'); if (reason) action(`/moderation/songs/${r.id}/review`,{checksum:r.checksum,decision:'REJECTED',reason}) }}>Reject revision #{r.id}</button></article>)}</>}
  </section>
}
