import { useEffect, useState } from 'react'
import { API_BASE_URL } from './apiOrigin.js'
export default function ProjectorSessionPicker({ onSelect }) {
  const [sessions, setSessions] = useState([])
  const [message, setMessage] = useState('')
  const [name, setName] = useState('Sunday service')
  useEffect(() => {
    let active = true
    fetch(`${API_BASE_URL}/projector/sessions`).then(r => { if (!r.ok) throw Error('Sessions unavailable'); return r.json() }).then(rows => {
      if (!active) return
      setSessions(rows)
      const selected = new URLSearchParams(location.search).get('session')
      if (selected && rows.some(row => row.id === selected)) onSelect(selected)
    }).catch(e => setMessage(e.message))
    return () => { active = false }
  }, [onSelect])
  return <section style={{ padding: 24 }} aria-label="Projector sessions"><h2>Choose a projector session</h2><p>Use the same session link on the operator and projector computers. Each computer must sign in to this church.</p>{message && <p role="alert">{message}</p>}
    {sessions.map(s => <p key={s.id}><button onClick={() => onSelect(s.id)}>{s.name}</button></p>)}
    <form onSubmit={async event => { event.preventDefault(); const r = await fetch(`${API_BASE_URL}/projector/sessions`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})}); if (r.ok) onSelect((await r.json()).id); else setMessage('Cannot create this session') }}><label>Session name <input value={name} maxLength={100} onChange={e => setName(e.target.value)} required /></label><button>Create projector session</button></form>
  </section>
}
